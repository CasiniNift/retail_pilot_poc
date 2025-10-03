# python-service/logger.py - Comprehensive logging for retail_pilot
import logging
import os
from logging.handlers import RotatingFileHandler
from datetime import datetime
from pathlib import Path

# Create logs directory in project root (one level up from python-service)
LOGS_DIR = Path(__file__).parent.parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)

# Log file paths
ERROR_LOG = LOGS_DIR / "errors.log"
APP_LOG = LOGS_DIR / "app.log"
SESSION_LOG = LOGS_DIR / "sessions.log"
AI_LOG = LOGS_DIR / "ai_calls.log"

# Custom formatter with more context


class DetailedFormatter(logging.Formatter):
    """Custom formatter with color support for console"""

    COLORS = {
        'DEBUG': '\033[36m',    # Cyan
        'INFO': '\033[32m',     # Green
        'WARNING': '\033[33m',  # Yellow
        'ERROR': '\033[31m',    # Red
        'CRITICAL': '\033[35m',  # Magenta
        'RESET': '\033[0m'      # Reset
    }

    def format(self, record):
        # Add color for console output
        if hasattr(record, 'use_color') and record.use_color:
            levelname = record.levelname
            color = self.COLORS.get(levelname, self.COLORS['RESET'])
            record.levelname = f"{color}{levelname}{self.COLORS['RESET']}"

        return super().format(record)

# Logger setup function


def setup_logger(name, log_file, level=logging.INFO, console=True):
    """Set up a logger with file and optional console output"""
    logger = logging.getLogger(name)
    logger.setLevel(level)

    # File handler with rotation (10MB max, keep 5 backups)
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    file_formatter = DetailedFormatter(
        '%(asctime)s | %(levelname)-8s | %(name)s | %(funcName)s:%(lineno)d | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)

    # Console handler (optional)
    if console:
        console_handler = logging.StreamHandler()
        console_formatter = DetailedFormatter(
            '%(levelname)s | %(name)s | %(message)s'
        )
        console_handler.setFormatter(console_formatter)

        # Add color to console logs
        def add_color_flag(record):
            record.use_color = True
            return True
        console_handler.addFilter(add_color_flag)

        logger.addHandler(console_handler)

    return logger


# Create specialized loggers
app_logger = setup_logger('app', APP_LOG)
error_logger = setup_logger('errors', ERROR_LOG, level=logging.ERROR)
session_logger = setup_logger('sessions', SESSION_LOG)
ai_logger = setup_logger('ai', AI_LOG)

# Convenience functions


def log_error(message, exc_info=True, extra_data=None):
    """Log error with full traceback and context"""
    error_logger.error(message, exc_info=exc_info)
    if extra_data:
        error_logger.error(f"Additional context: {extra_data}")


def log_session_event(session_id, event_type, details=None):
    """Log session-related events"""
    msg = f"Session {session_id[:8]} | {event_type}"
    if details:
        msg += f" | {details}"
    session_logger.info(msg)


def log_ai_call(question, language, success=True, error=None, tokens=None):
    """Log Claude AI API calls"""
    status = "SUCCESS" if success else "FAILED"
    msg = f"{status} | Question: {question} | Language: {language}"

    if tokens:
        msg += f" | Tokens: {tokens}"

    if error:
        msg += f" | Error: {error}"

    ai_logger.info(msg)


def log_app_info(message):
    """Log general application info"""
    app_logger.info(message)


def log_app_warning(message):
    """Log application warnings"""
    app_logger.warning(message)


def log_file_upload(session_id, files_uploaded):
    """Log file upload events"""
    session_logger.info(
        f"Session {session_id[:8]} | Upload | Files: {', '.join(files_uploaded)}"
    )


def log_analysis_request(session_id, question, budget=None):
    """Log analysis requests"""
    msg = f"Session {session_id[:8]} | Analysis | Question: {question}"
    if budget:
        msg += f" | Budget: €{budget}"
    session_logger.info(msg)

# Startup function


def initialize_logging():
    """Initialize logging system and log startup"""
    log_app_info("=" * 60)
    log_app_info("AI Cash Flow Assistant - Retail Pilot STARTING")
    log_app_info(f"Logs directory: {LOGS_DIR}")
    log_app_info(f"Timestamp: {datetime.now().isoformat()}")
    log_app_info("=" * 60)

# Exception logger decorator


def log_exceptions(logger_func=log_error):
    """Decorator to automatically log exceptions"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                logger_func(
                    f"Exception in {func.__name__}: {str(e)}",
                    exc_info=True,
                    extra_data={'args': args, 'kwargs': kwargs}
                )
                raise
        return wrapper
    return decorator
