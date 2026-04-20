import os
import yaml
from crewai import Task
from agents import create_data_analyst_agent, create_report_writer_agent

current_dir = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(current_dir, 'config', 'tasks.yaml'), 'r', encoding='utf-8') as f:
    tasks_config = yaml.safe_load(f)

def create_analysis_tasks(portfolio_data: str, task_info: str) -> list[Task]:
    data_analyst = create_data_analyst_agent()
    report_writer = create_report_writer_agent()

    analyze_config = tasks_config['analyze_task'].copy()
    # Dinamik verileri YAML'dan gelen şablona enjekte ediyoruz
    analyze_config['description'] = analyze_config['description'].format(
        task_info=task_info,
        portfolio_data=portfolio_data
    )

    analyze_task = Task(
        **analyze_config,
        agent=data_analyst,
    )

    report_config = tasks_config['report_task'].copy()

    report_task = Task(
        **report_config,
        agent=report_writer,
        context=[analyze_task],
    )

    return [analyze_task, report_task]
