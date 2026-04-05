from crewai import Task
from agents import create_data_analyst_agent, create_report_writer_agent


def create_analysis_tasks(portfolio_data: str, task_info: str) -> list[Task]:
    data_analyst = create_data_analyst_agent()
    report_writer = create_report_writer_agent()

    analyze_task = Task(
        description=f"""
Analyze the following portfolio data and produce a structured quantitative summary.

TASK CONTEXT:
{task_info}

PORTFOLIO DATA (JSON):
{portfolio_data}

Your output MUST include:
1. Total number of assets and their type distribution (BIST / Crypto / PreciousMetal counts and %)
2. Total portfolio value per currency (only where current_value is available)
3. Asset concentration: top 3 assets by quantity*average_cost weight (%)
4. Diversification score: how spread the portfolio is across asset types and currencies
5. Any notable data points (e.g., a single asset representing >50% of total cost basis)

Output as a structured JSON object.
DO NOT provide any investment advice or recommendations whatsoever.
""",
        expected_output=(
            "A JSON object with quantitative portfolio analysis metrics including "
            "asset_count, type_distribution, top_assets, currency_breakdown, and notable_observations."
        ),
        agent=data_analyst,
    )

    report_task = Task(
        description=f"""
Using the quantitative analysis from the previous task, write an objective pre-analysis report.

The report is for a LICENSED ECONOMIST who will review the client's portfolio before starting their work.
Write in Turkish. Be professional and concise.

STRICT RULES — VIOLATIONS ARE NOT ACCEPTABLE:
- ASLA yatırım tavsiyesi verme (al/sat/tut önerisi YOK)
- ASLA yönlendirme yapma
- Sadece VERİYE DAYALI gözlemler yaz
- "Tavsiye" yerine "tespit" veya "gözlem" kullan
- Risk seviyesini YALNIZCA portföy çeşitlendirmesi ve konsantrasyon oranına göre belirle:
    * Low: 5+ varlık, 3+ farklı tip, tek varlık <%20
    * High: tek tip varlık veya tek varlık >%60
    * Medium: diğer durumlar

Your output MUST be a valid JSON object with EXACTLY these fields:
{{
    "summary": "2-3 cümlelik genel portföy özeti (Türkçe)",
    "risk_level": "Low veya Medium veya High",
    "market_outlook": "Portföy yapısına dayalı kısa gözlem, tavsiye DEĞİL (Türkçe)",
    "key_findings": ["tespit 1", "tespit 2", "tespit 3"]
}}

Output ONLY the JSON object. No extra text before or after.
""",
        expected_output=(
            "A valid JSON object with fields: summary, risk_level, market_outlook, key_findings."
        ),
        agent=report_writer,
        context=[analyze_task],
    )

    return [analyze_task, report_task]
