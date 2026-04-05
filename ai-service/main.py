import json
import traceback
from datetime import datetime, timezone

import uvicorn
from fastapi import FastAPI, HTTPException
from models import AnalyzeRequest, AnalyzeResponse
from crew import run_pre_analysis_crew
from config import FASTAPI_PORT
from validators import PortfolioValidator, ReportValidator

app = FastAPI(
    title="FinTreX PAA — Pre-Analysis Assistant",
    version="1.0.0",
    description="CrewAI-powered objective portfolio pre-analysis service for FinTreX.",
)


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "paa-crew"}


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


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=FASTAPI_PORT, reload=True)
