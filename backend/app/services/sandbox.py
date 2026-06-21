import io
import sys
import re
import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple

# Block list of keywords to prevent malicious activity in the exec call
BLOCKED_KEYWORDS = [
    "import os", "import sys", "import subprocess", "import shutil", "import socket",
    "eval(", "exec(", "open(", "write(", "read(", "getattr", "setattr", "eval ", "exec ",
    "builtins", "__import__", "__code__", "__globals__", "__dict__", "system("
]

def check_security(code: str) -> bool:
    """Verifies that the generated python code does not violate security constraints."""
    for keyword in BLOCKED_KEYWORDS:
        if keyword in code:
            return False
    return True

def run_pandas_code_safely(df: pd.DataFrame, code: str) -> Tuple[bool, str, Any]:
    """Runs a single Pandas code block on a DataFrame in a sandboxed local environment.
    
    Returns:
        (success_bool, stdout_string, final_result_object)
    """
    if not check_security(code):
        return False, "Security Exception: Blocked keyword or imports detected.", None
        
    # Redirect stdout
    old_stdout = sys.stdout
    redirected_output = sys.stdout = io.StringIO()
    
    # Pre-populate globals/locals namespace
    local_vars = {
        "df": df,
        "pd": pd,
        "np": np
    }
    
    try:
        # We search if the user attempts to assign a final output to a variable, e.g., 'result = ...'
        # Or we can just execute the code. If there's a specific variable named 'result', we return it.
        # Let's clean the code: ensure it doesn't try to access __globals__ or parent system.
        exec(code, {"__builtins__": {}}, local_vars)
        
        stdout_str = redirected_output.getvalue()
        result = local_vars.get("result", None)
        
        return True, stdout_str, result
    except Exception as e:
        return False, f"Execution Error: {str(e)}", None
    finally:
        sys.stdout = old_stdout
