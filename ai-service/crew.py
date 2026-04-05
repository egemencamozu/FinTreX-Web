import json
from crewai import Crew, Process
from tasks import create_analysis_tasks
from models import AnalyzeRequest


def run_pre_analysis_crew(request: AnalyzeRequest) -> str:
    """
    Run the PreAnalysis crew and return the raw string output
    of the final task (the report writer's JSON).
    """
    portfolio_data = json.dumps(
        [p.model_dump() for p in request.user_portfolios],
        ensure_ascii=False,
        indent=2,
    )

    task_info = (
        f"Görev Başlığı: {request.task_title}\n"
        f"Görev Açıklaması: {request.task_description}\n"
        f"Kategori: {request.task_category}"
    )

    crew_tasks = create_analysis_tasks(portfolio_data, task_info)

    crew = Crew(
        agents=[t.agent for t in crew_tasks],
        tasks=crew_tasks,
        process=Process.sequential,
        verbose=True,
    )

    result = crew.kickoff()

    # CrewAI returns a CrewOutput object; .raw gives the last task's text output
    return result.raw if hasattr(result, "raw") else str(result)
