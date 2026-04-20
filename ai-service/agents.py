import os
import yaml
from crewai import Agent
from config import get_llm

current_dir = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(current_dir, 'config', 'agents.yaml'), 'r', encoding='utf-8') as f:
    agents_config = yaml.safe_load(f)

def create_data_analyst_agent() -> Agent:
    return Agent(
        **agents_config['data_analyst'],
        verbose=True,
        allow_delegation=False,
        llm=get_llm(),
    )


def create_report_writer_agent() -> Agent:
    return Agent(
        **agents_config['report_writer'],
        verbose=True,
        allow_delegation=False,
        llm=get_llm(),
    )
