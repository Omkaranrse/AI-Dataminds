from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from app.db.session import get_session
from app.models.models import Dataset, AnalysisReport, User
from app.schemas.schemas import AnalysisReportOut
from app.api.deps import get_current_user
from app.services.agent_workflow import analyze_dataset_workflow

router = APIRouter()

@router.post("/{dataset_id}", response_model=AnalysisReportOut, status_code=status.HTTP_201_CREATED)
def trigger_analysis(
    dataset_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    dataset = db.get(Dataset, dataset_id)
    if not dataset or dataset.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    try:
        report = analyze_dataset_workflow(db, dataset.id)
        return report
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"LangGraph analysis workflow failed: {str(e)}"
        )

@router.get("/project/{project_id}", response_model=List[AnalysisReportOut])
def get_project_reports(
    project_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    statement = select(AnalysisReport).where(AnalysisReport.project_id == project_id)
    reports = db.exec(statement).all()
    return reports

@router.get("/report/{report_id}", response_model=AnalysisReportOut)
def get_report(
    report_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    report = db.get(AnalysisReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report
