import json
import traceback
from datetime import datetime, timezone
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from models import AnalyzeRequest, AnalyzeResponse
from pre_analysis_crew.crew import run_pre_analysis_crew
from config import FASTAPI_PORT
from validators import PortfolioValidator, ReportValidator

try:
    from mcp_demo.client import run_mcp_demo
except ImportError:
    run_mcp_demo = None

# === LangGraph AI Assistant Imports ===
import uuid
import logging
from langgraph_assistant import compiled_graph, AiChatRequest, AiChatResponse
from langgraph_assistant.concurrency import conversation_lock_manager
from config import BACKEND_API_URL

logger = logging.getLogger(__name__)

app = FastAPI(
    title="FinTreX PAA — Pre-Analysis Assistant",
    version="1.0.0",
    description="CrewAI-powered objective portfolio pre-analysis service for FinTreX.",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "http://127.0.0.1:4200",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "paa-crew"}


@app.get("/mcp/health")
def mcp_health_check():
    return {
        "status": "healthy",
        "service": "fintrex-mcp",
        "transport": "stdio",
        "description": "FinTreX MCP server is available through the AI service.",
    }


@app.get("/mcp/demo")
async def get_mcp_demo():
    if run_mcp_demo is None:
        raise HTTPException(status_code=503, detail="MCP is not available in this environment.")

    try:
        return await run_mcp_demo()
    except Exception as e:
        logger.error(f"MCP Error: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"MCP failed: {str(e)}")


@app.post("/mcp/demo")
async def post_mcp_demo(payload: dict[str, Any]):
    if run_mcp_demo is None:
        raise HTTPException(status_code=503, detail="MCP is not available in this environment.")

    try:
        return await run_mcp_demo(payload)
    except Exception as e:
        logger.error(f"MCP Error: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"MCP failed: {str(e)}")


@app.get("/mcp/run")
async def get_mcp_run():
    return await get_mcp_demo()


@app.post("/mcp/run")
async def post_mcp_run(payload: dict[str, Any]):
    return await post_mcp_demo(payload)


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze_portfolio(request: AnalyzeRequest):
    """
    Kullanıcının portföy verilerini alır, CrewAI ile analiz eder ve
    ekonomiste sunulacak tarafsız bir ön-analiz raporu döner.
    """
    # Input validation
    portfolio_validation_error = PortfolioValidator.validate_portfolios(request.user_portfolios)
    if portfolio_validation_error:
        return AnalyzeResponse(
            task_id=request.task_id,
            summary="",
            risk_level="",
            market_outlook="",
            key_findings="[]",
            raw_content="",
            is_successful=False,
            error_message=f"Input validation failed: {portfolio_validation_error}",
            generated_at_utc=datetime.now(timezone.utc).isoformat(),
        )

    try:
        raw_output = run_pre_analysis_crew(request)

        # JSON bloğunu çıkar (model bazen markdown code block içine koyabilir)
        text = raw_output.strip()
        if "```" in text:
            # ```json ... ``` bloğunu temizle
            text = text.split("```")[-2] if text.count("```") >= 2 else text
            text = text.lstrip("json").strip()

        json_start = text.find("{")
        json_end = text.rfind("}") + 1
        parsed: dict = {}
        if json_start != -1 and json_end > json_start:
            try:
                parsed = json.loads(text[json_start:json_end])
            except json.JSONDecodeError:
                parsed = {}

        key_findings = parsed.get("key_findings", [])
        if isinstance(key_findings, list):
            key_findings_str = json.dumps(key_findings, ensure_ascii=False)
        else:
            key_findings_str = json.dumps([], ensure_ascii=False)

        summary = parsed.get("summary", "Rapor oluşturuldu ancak özet parse edilemedi.")
        risk_level = parsed.get("risk_level", "Medium")
        market_outlook = parsed.get("market_outlook", "")
        key_findings = parsed.get("key_findings", [])

        # Post-generation validation: Check for investment advice violations
        validation_error = ReportValidator.validate_report(summary, market_outlook, key_findings)
        if validation_error:
            # Log but don't fail — sanitize instead
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Report validation warning for task {request.task_id}: {validation_error}")
            summary, market_outlook, key_findings = ReportValidator.sanitize_report(
                summary, market_outlook, key_findings
            )

        if isinstance(key_findings, list):
            key_findings_str = json.dumps(key_findings, ensure_ascii=False)
        else:
            key_findings_str = json.dumps([], ensure_ascii=False)

        return AnalyzeResponse(
            task_id=request.task_id,
            summary=summary,
            risk_level=risk_level,
            market_outlook=market_outlook,
            key_findings=key_findings_str,
            raw_content=raw_output,
            is_successful=True,
            error_message=None,
            generated_at_utc=datetime.now(timezone.utc).isoformat(),
        )

    except Exception as e:
        error_detail = f"PAA Error: {str(e)}\n{traceback.format_exc()}"
        return AnalyzeResponse(
            task_id=request.task_id,
            summary="",
            risk_level="",
            market_outlook="",
            key_findings="[]",
            raw_content="",
            is_successful=False,
            error_message=error_detail,
            generated_at_utc=datetime.now(timezone.utc).isoformat(),
        )


@app.post("/ai-chat", response_model=AiChatResponse)
async def ai_chat(request: AiChatRequest):
    """
    LangGraph tabanlı interaktif AI Portföy Asistanı endpoint'i.
    Çok turlu konuşma, canlı veri ve yatırım tavsiyesi koruması içerir.
    """
    conv_id = request.conversation_id or f"conv_{uuid.uuid4().hex[:12]}"

    # Concurrency kontrolü: Aynı conversation için aynı anda tek istek
    if not await conversation_lock_manager.acquire(conv_id):
        raise HTTPException(status_code=429, detail="Bu konuşmada bir mesaj işleniyor, lütfen bekleyin.")

    try:
        # Initial state hazırlığı
        initial_state = {
            "messages": request.conversation_history or [],
            "conversation_id": conv_id,
            "user_id": request.user_id,
            "user_role": request.user_role,
            "current_user_message": request.message,
            "tool_calls": [],
            "tool_results": {},
            "tool_errors": {},
            "guardrail_retry_count": 0,
            "backend_api_url": BACKEND_API_URL,
            "auth_token": request.auth_token,
            "client_id": request.context.client_id if request.context else None
        }

        # Graph'ı çalıştır
        final_state = await compiled_graph.ainvoke(initial_state)

        # Cevabı dön
        return AiChatResponse(
            conversation_id=conv_id,
            message=final_state.get("final_response", "Cevap üretilemedi."),
            tools_used=[t.get("name") for t in final_state.get("tool_calls", []) if t.get("name")],
            is_successful=True,
            partial_data=final_state.get("partial_data", False)
        )

    except Exception as e:
        logger.error(f"AiChat Error: {str(e)}\n{traceback.format_exc()}")
        return AiChatResponse(
            conversation_id=conv_id,
            message="Üzgünüm, isteğinizi şu an işleyemiyorum.",
            tools_used=[],
            is_successful=False,
            error_message=str(e)
        )
    finally:
        # Lock'u serbest bırak
        await conversation_lock_manager.release(conv_id)


@app.post("/ai-chat/stream")
async def ai_chat_stream(request: AiChatRequest):
    """
    LangGraph tabanlı interaktif AI Portföy Asistanı (Streaming) endpoint'i.
    Cevabı kelime kelime (token token) SSE protokolü ile akıtır.
    """
    conv_id = request.conversation_id or f"conv_{uuid.uuid4().hex[:12]}"

    async def event_generator():
        # Concurrency kontrolü: Aynı conversation için aynı anda tek istek
        if not await conversation_lock_manager.acquire(conv_id):
            yield {
                "event": "message",
                "data": json.dumps({"type": "error", "message": "Bu konuşmada bir mesaj işleniyor, lütfen bekleyin."}, ensure_ascii=False)
            }
            return

        try:
            initial_state = {
                "messages": request.conversation_history or [],
                "conversation_id": conv_id,
                "user_id": request.user_id,
                "user_role": request.user_role,
                "current_user_message": request.message,
                "tool_calls": [],
                "tool_results": {},
                "tool_errors": {},
                "guardrail_retry_count": 0,
                "backend_api_url": BACKEND_API_URL,
                "auth_token": request.auth_token,
                "client_id": request.context.client_id if request.context else None
            }

            tools_used = []
            final_partial_data = False

            # Graph'ı astream_events ile çalıştır (v2)
            async for event in compiled_graph.astream_events(initial_state, version="v2"):
                kind = event["event"]

                # 1. Token streaming (synthesizer node'dan gelen chat model çıktıları)
                if kind == "on_chat_model_stream":
                    content = event["data"]["chunk"].content
                    if content:
                        yield {
                            "event": "message",
                            "data": json.dumps({"type": "token", "content": content}, ensure_ascii=False)
                        }

                # 2. Tool başlangıç
                elif kind == "on_tool_start":
                    tool_name = event["name"]
                    tools_used.append(tool_name)
                    yield {
                        "event": "message",
                        "data": json.dumps({"type": "tool_start", "tool": tool_name}, ensure_ascii=False)
                    }

                # 3. Tool bitiş
                elif kind == "on_tool_end":
                    tool_name = event["name"]
                    # output is in event["data"]["output"]
                    success = not (isinstance(event["data"]["output"], dict) and event["data"]["output"].get("_tool_failed"))
                    yield {
                        "event": "message",
                        "data": json.dumps({"type": "tool_end", "tool": tool_name, "success": success}, ensure_ascii=False)
                    }

                # 4. Final state yakalama (astream_events bittiğinde state'ten bilgileri alacağız)
                elif kind == "on_chain_end" and event.get("name") == "LangGraph":
                    output = event.get("data", {}).get("output", {})
                    if isinstance(output, dict) and "partial_data" in output:
                        final_partial_data = output["partial_data"]

            # Sonuç özeti için graph'ı bir kez de invoke etmek veya astream_events sonundaki state'e erişmek gerekebilir.
            # astream_events v2 tüm event'leri döner ama final state'i tek bir event'te vermez.
            # En temiz yol, stream bittikten sonra state'i bir de invoke ile değil,
            # stream sırasında biriktirilen bilgilerle (tools_used vb.) simüle etmek
            # ya da astream_events'i bir dict'e toplayıp state'e bakmaktır.
            # Şimdilik tools_used'ı stream sırasında topladık.

            yield {
                "event": "message",
                "data": json.dumps({
                    "type": "done", 
                    "conversation_id": conv_id, 
                    "tools_used": list(set(tools_used)),
                    "partial_data": final_partial_data
                }, ensure_ascii=False)
            }

        except Exception as e:
            logger.error(f"AiChat Stream Error: {str(e)}\n{traceback.format_exc()}")
            yield {
                "event": "message",
                "data": json.dumps({"type": "error", "message": str(e)}, ensure_ascii=False)
            }
        finally:
            await conversation_lock_manager.release(conv_id)

    return EventSourceResponse(event_generator())


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=FASTAPI_PORT, reload=True)
