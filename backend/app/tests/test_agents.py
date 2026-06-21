import pytest
import pandas as pd
from app.services.sandbox import run_pandas_code_safely, check_security
from app.services.agent_workflow import run_extraction_node, run_cleaning_node

def test_security_check():
    # Safe code
    assert check_security("result = df['age'].mean()") is True
    # Dangerous code
    assert check_security("import os; os.system('ls')") is False
    assert check_security("eval('df.head()')") is False
    assert check_security("open('/etc/passwd').read()") is False

def test_safe_execution():
    df = pd.DataFrame({
        "age": [20, 30, 40],
        "name": ["Alice", "Bob", "Charlie"]
    })
    
    # Check valid pandas evaluation
    success, stdout, result = run_pandas_code_safely(df, "result = df['age'].sum()")
    assert success is True
    assert result == 90
    
    # Check syntax error
    success, stdout, result = run_pandas_code_safely(df, "result = df['age'].sum(")
    assert success is False
    assert "SyntaxError" in stdout or "Execution Error" in stdout

def test_cleaning_node():
    # Mock state
    state = {
        "summary": {
            "columns": [
                {"name": "age", "null_count": 2, "type": "float64"},
                {"name": "name", "null_count": 0, "type": "object"}
            ]
        }
    }
    
    res = run_cleaning_node(state)
    assert "eda_insights" in res
    anomalies = res["eda_insights"][0]["details"]
    assert len(anomalies) == 1
    assert anomalies[0]["column"] == "age"
    assert "Contains 2 null values" in anomalies[0]["issue"]
