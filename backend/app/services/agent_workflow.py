import os
import pandas as pd
import json
from typing import Dict, Any, List, TypedDict, Annotated
from sqlmodel import Session
from app.models.models import Dataset, AnalysisReport
from app.config import settings

# LangChain / LangGraph imports
try:
    from langchain_openai import ChatOpenAI
    from langgraph.graph import StateGraph, END
    HAS_LANGGRAPH = True
except ImportError:
    HAS_LANGGRAPH = False

class AgentState(TypedDict):
    dataset_id: int
    filepath: str
    filename: str
    row_count: int
    column_count: int
    summary: Dict[str, Any]
    eda_insights: List[Dict[str, Any]]
    visualizations: List[Dict[str, Any]]
    final_report: str
    errors: List[str]

def run_extraction_node(state: AgentState) -> Dict[str, Any]:
    """Node: Extract metadata and column structures."""
    filepath = state["filepath"]
    ext = os.path.splitext(state["filename"])[1].lower()
    
    try:
        if ext == '.csv':
            df = pd.read_csv(filepath, nrows=1000)
        elif ext in ['.xlsx', '.xls']:
            df = pd.read_excel(filepath, nrows=1000)
        else:
            try:
                df = pd.read_json(filepath)
            except Exception:
                df = pd.read_json(filepath, lines=True)

        cols = []
        for col in df.columns:
            cols.append({
                "name": col,
                "type": str(df[col].dtype),
                "null_count": int(df[col].isnull().sum()),
                "unique_count": int(df[col].nunique())
            })
            
        return {
            "summary": {
                "columns": cols,
                "sample_head": df.head(5).to_dict(orient="records")
            }
        }
    except Exception as e:
        return {"errors": state.get("errors", []) + [f"Extraction Node error: {str(e)}"]}

def run_cleaning_node(state: AgentState) -> Dict[str, Any]:
    """Node: Identify outstanding anomalies or missing values."""
    cols = state["summary"].get("columns", [])
    anomalies = []
    for col in cols:
        if col["null_count"] > 0:
            anomalies.append({
                "column": col["name"],
                "issue": f"Contains {col['null_count']} null values",
                "severity": "medium"
            })
    return {"eda_insights": [{"type": "cleaning", "details": anomalies}]}

def run_eda_node(state: AgentState) -> Dict[str, Any]:
    """Node: Perform descriptive statistics and identify main trends."""
    filepath = state["filepath"]
    ext = os.path.splitext(state["filename"])[1].lower()
    
    try:
        if ext == '.csv':
            df = pd.read_csv(filepath)
        elif ext in ['.xlsx', '.xls']:
            df = pd.read_excel(filepath)
        else:
            try:
                df = pd.read_json(filepath)
            except Exception:
                df = pd.read_json(filepath, lines=True)

        insights = list(state.get("eda_insights", []))
        
        # Calculate summary statistics for numeric fields
        numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
        for col in numeric_cols:
            desc = df[col].describe()
            insights.append({
                "type": "numeric_summary",
                "column": col,
                "mean": float(desc["mean"]) if not pd.isna(desc["mean"]) else 0.0,
                "min": float(desc["min"]) if not pd.isna(desc["min"]) else 0.0,
                "max": float(desc["max"]) if not pd.isna(desc["max"]) else 0.0,
                "std": float(desc["std"]) if not pd.isna(desc["std"]) else 0.0,
            })
            
        # Basic correlation analysis
        if len(numeric_cols) >= 2:
            corr_matrix = df[numeric_cols].corr().to_dict()
            insights.append({
                "type": "correlation",
                "matrix": corr_matrix
            })
            
        return {"eda_insights": insights}
    except Exception as e:
        return {"errors": state.get("errors", []) + [f"EDA Node error: {str(e)}"]}

def run_visualization_node(state: AgentState) -> Dict[str, Any]:
    """Node: Propose and generate Recharts-compatible configurations."""
    filepath = state["filepath"]
    ext = os.path.splitext(state["filename"])[1].lower()
    
    try:
        if ext == '.csv':
            df = pd.read_csv(filepath)
        elif ext in ['.xlsx', '.xls']:
            df = pd.read_excel(filepath)
        else:
            try:
                df = pd.read_json(filepath)
            except Exception:
                df = pd.read_json(filepath, lines=True)

        visualizations = []
        numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
        categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        
        # 1. Bar Chart: Categorical counts (e.g. top categories)
        for col in categorical_cols[:2]:
            counts = df[col].value_counts().head(8)
            chart_data = [{"name": str(k), "value": int(v)} for k, v in counts.items()]
            visualizations.append({
                "title": f"Distribution of {col}",
                "type": "bar",
                "xAxis": "name",
                "yAxis": "value",
                "data": chart_data
            })
            
        # 2. Line Chart / Scatter: Numeric relationship
        if len(numeric_cols) >= 2:
            sample_df = df.head(100) # limit to prevent heavy frontend rendering
            chart_data = []
            x_col = numeric_cols[0]
            y_col = numeric_cols[1]
            for idx, row in sample_df.iterrows():
                chart_data.append({
                    "x": float(row[x_col]) if not pd.isna(row[x_col]) else 0,
                    "y": float(row[y_col]) if not pd.isna(row[y_col]) else 0,
                    "index": idx
                })
            visualizations.append({
                "title": f"Relationship: {y_col} vs {x_col}",
                "type": "line",
                "xAxis": "x",
                "yAxis": "y",
                "data": chart_data
            })
            
        # 3. Simple Pie Chart
        for col in categorical_cols[:1]:
            counts = df[col].value_counts().head(5)
            chart_data = [{"name": str(k), "value": int(v)} for k, v in counts.items()]
            visualizations.append({
                "title": f"Top Categories in {col}",
                "type": "pie",
                "data": chart_data
            })

        return {"visualizations": visualizations}
    except Exception as e:
        return {"errors": state.get("errors", []) + [f"Visualization Node error: {str(e)}"]}

def run_insight_node(state: AgentState) -> Dict[str, Any]:
    """Node: Compile comprehensive markdown report based on previous insights."""
    filename = state["filename"]
    row_count = state["row_count"]
    col_count = state["column_count"]
    insights = state.get("eda_insights", [])
    
    # Standard fallback content
    report_md = f"""# Autonomous Data Analysis Report for `{filename}`

## 1. Executive Summary
The dataset `{filename}` contains **{row_count}** rows and **{col_count}** columns. The following report outlines primary distributions, data structures, and statistical relationships detected.

## 2. Data Cleaning Status
"""
    
    cleaning_insights = [i for i in insights if i.get("type") == "cleaning"]
    if cleaning_insights and cleaning_insights[0].get("details"):
        issues = cleaning_insights[0]["details"]
        report_md += "The following issues were identified in the data structure:\n"
        for issue in issues:
            report_md += f"- **{issue['column']}**: {issue['issue']} (Severity: {issue['severity']})\n"
    else:
        report_md += "No major data quality issues or missing values were detected in the sampled rows.\n"
        
    report_md += "\n## 3. Statistical Summaries\n"
    numeric_summaries = [i for i in insights if i.get("type") == "numeric_summary"]
    if numeric_summaries:
        report_md += "| Column | Minimum | Mean | Maximum | Std Dev |\n| --- | --- | --- | --- | --- |\n"
        for summary in numeric_summaries:
            report_md += f"| {summary['column']} | {summary['min']:.2f} | {summary['mean']:.2f} | {summary['max']:.2f} | {summary['std']:.2f} |\n"
    else:
        report_md += "No numeric fields available for descriptive statistical summaries.\n"
        
    # Use LLM to refine the report if API key exists
    if settings.OPENAI_API_KEY:
        try:
            llm = ChatOpenAI(openai_api_key=settings.OPENAI_API_KEY, model="gpt-4o-mini", temperature=0.2)
            prompt = f"""
            You are an expert Data Insight Agent. Write a detailed, enterprise-ready, professional executive analysis report in Markdown based on the following stats:
            - Filename: {filename}
            - Rows: {row_count}, Columns: {col_count}
            - Insights: {json.dumps(insights)}
            - Visualizations Proposed: {json.dumps(state.get('visualizations', []))}
            
            Keep the report actionable and clean. Maintain the markdown format.
            """
            response = llm.invoke(prompt)
            if response.content:
                report_md = str(response.content)
        except Exception:
            pass # fallback to default generated markdown

    return {"final_report": report_md}

def analyze_dataset_workflow(db: Session, dataset_id: int) -> AnalysisReport:
    """Orchestrates and executes the complete multi-agent LangGraph workflow."""
    dataset = db.get(Dataset, dataset_id)
    if not dataset:
        raise ValueError("Dataset not found")
        
    # Initialize state
    state: AgentState = {
        "dataset_id": dataset.id,
        "filepath": dataset.cleaned_filepath or dataset.filepath,
        "filename": dataset.filename,
        "row_count": dataset.row_count or 0,
        "column_count": dataset.column_count or 0,
        "summary": dataset.summary or {},
        "eda_insights": [],
        "visualizations": [],
        "final_report": "",
        "errors": []
    }
    
    # 1. Extraction Node
    res = run_extraction_node(state)
    state.update(res)
    
    # 2. Cleaning Node
    res = run_cleaning_node(state)
    state.update(res)
    
    # 3. EDA Node
    res = run_eda_node(state)
    state.update(res)
    
    # 4. Visualization Node
    res = run_visualization_node(state)
    state.update(res)
    
    # 5. Insight/Report Node
    res = run_insight_node(state)
    state.update(res)
    
    # Save Report
    report = AnalysisReport(
        project_id=dataset.project_id,
        dataset_id=dataset.id,
        title=f"Auto-Analysis: {dataset.filename}",
        content=state["final_report"],
        visualizations=state["visualizations"]
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    
    return report
