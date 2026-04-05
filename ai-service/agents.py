from crewai import Agent
from config import get_llm


def create_data_analyst_agent() -> Agent:
    return Agent(
        role="Portfolio Data Analyst",
        goal=(
            "Analyze the given portfolio data and extract objective, "
            "quantitative insights. Calculate asset distribution percentages, "
            "total portfolio value per currency, concentration ratios, "
            "and asset type breakdown."
        ),
        backstory=(
            "You are a meticulous financial data analyst who works with raw "
            "portfolio data. You NEVER give investment advice. You only produce "
            "factual, numerical summaries of the data you receive. You identify "
            "patterns in the data such as concentration risk or diversification "
            "levels purely based on mathematical ratios."
        ),
        verbose=True,
        allow_delegation=False,
        llm=get_llm(),
    )


def create_report_writer_agent() -> Agent:
    return Agent(
        role="Objective Report Writer",
        goal=(
            "Transform quantitative portfolio analysis into a clear, professional, "
            "and strictly OBJECTIVE report for an economist to review. "
            "The report must contain NO investment advice, NO buy/sell/hold "
            "recommendations, and NO directional market predictions."
        ),
        backstory=(
            "You are a professional report writer specializing in financial data "
            "summarization. Your reports are used by licensed economists as a "
            "starting point for their own analysis. You present FACTS and "
            "OBSERVATIONS only. You never use words like 'recommend', 'should', "
            "'consider buying/selling'. Instead you use 'observation', 'finding', "
            "'data indicates'. You write in Turkish."
        ),
        verbose=True,
        allow_delegation=False,
        llm=get_llm(),
    )
