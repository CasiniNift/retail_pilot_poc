#!/usr/bin/env python3
# python-service/test_logging.py - Test that logging is working correctly

import sys
from pathlib import Path

print("🧪 Testing Logging Setup for Retail Pilot")
print("=" * 50)

# Test 1: Check if logger.py exists
print("\n1️⃣  Checking if logger.py exists...")
logger_file = Path(__file__).parent / "logger.py"
if logger_file.exists():
    print("   ✅ logger.py found")
else:
    print("   ❌ logger.py NOT FOUND")
    print("   → Please add logger.py to python-service/")
    sys.exit(1)

# Test 2: Import logger module
print("\n2️⃣  Testing logger import...")
try:
    from logger import (
        initialize_logging,
        log_app_info,
        log_app_warning,
        log_error,
        log_ai_call,
        LOGS_DIR
    )
    print("   ✅ Logger imported successfully")
except ImportError as e:
    print(f"   ❌ Failed to import logger: {e}")
    sys.exit(1)

# Test 3: Check logs directory
print("\n3️⃣  Checking logs directory...")
if LOGS_DIR.exists():
    print(f"   ✅ Logs directory exists: {LOGS_DIR}")
else:
    print(f"   ⚠️  Logs directory will be created: {LOGS_DIR}")

# Test 4: Initialize logging
print("\n4️⃣  Initializing logging system...")
try:
    initialize_logging()
    print("   ✅ Logging initialized")
except Exception as e:
    print(f"   ❌ Failed to initialize logging: {e}")
    sys.exit(1)

# Test 5: Write test logs
print("\n5️⃣  Writing test log entries...")
try:
    log_app_info("Test log entry - INFO level")
    log_app_warning("Test log entry - WARNING level")

    # Test error logging
    try:
        raise ValueError("This is a test error")
    except Exception as e:
        log_error("Test error logging", exc_info=True)

    # Test AI call logging
    log_ai_call(
        question="Test question",
        language="English",
        success=True,
        tokens=100
    )

    print("   ✅ Test logs written")
except Exception as e:
    print(f"   ❌ Failed to write test logs: {e}")
    sys.exit(1)

# Test 6: Verify log files were created
print("\n6️⃣  Verifying log files...")
log_files = {
    "app.log": LOGS_DIR / "app.log",
    "errors.log": LOGS_DIR / "errors.log",
    "ai_calls.log": LOGS_DIR / "ai_calls.log"
}

all_exist = True
for name, path in log_files.items():
    if path.exists():
        size = path.stat().st_size
        print(f"   ✅ {name} exists ({size} bytes)")
    else:
        print(f"   ❌ {name} NOT FOUND")
        all_exist = False

if not all_exist:
    print("\n   ⚠️  Some log files were not created")
    sys.exit(1)

# Test 7: Read back test logs
print("\n7️⃣  Reading test logs...")
try:
    app_log = LOGS_DIR / "app.log"
    with open(app_log, 'r') as f:
        lines = f.readlines()
        last_lines = lines[-3:] if len(lines) >= 3 else lines
        print(f"   Last {len(last_lines)} entries from app.log:")
        for line in last_lines:
            print(f"   {line.strip()}")
    print("   ✅ Logs are readable")
except Exception as e:
    print(f"   ❌ Failed to read logs: {e}")
    sys.exit(1)

# Success!
print("\n" + "=" * 50)
print("✅ ALL TESTS PASSED!")
print("\nLogging is working correctly. You can now:")
print("  • Start your FastAPI service: python main.py")
print("  • Monitor logs: tail -f ../logs/app.log")
print("  • Check errors: tail -f ../logs/errors.log")
print("  • View AI calls: tail -f ../logs/ai_calls.log")
print("\n📖 For more info, see LOGGING.md")
