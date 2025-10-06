# python-service/ai_assistant.py - Claude Integration with logging

import os
import anthropic
from typing import Dict, Any, Optional, List
import pandas as pd
import json
import re
from datetime import datetime, timedelta

# Import logger with fallback
try:
    from logger import log_ai_call, log_error, log_app_info, log_app_warning
    LOGGING_AVAILABLE = True
except ImportError:
    LOGGING_AVAILABLE = False
    def log_ai_call(*args, **kwargs): pass
    def log_error(*args, **kwargs): pass
    def log_app_info(*args, **kwargs): pass
    def log_app_warning(*args, **kwargs): pass


class CashFlowAIAssistant:
    """AI-powered cash flow analysis assistant using Claude (Anthropic)"""

    def __init__(self, model=None, api_key=None):
        self.model = model or "claude-3-haiku-20240307"  # Fast and cost-effective
        self.api_key = api_key or self._get_claude_key()

        if self.api_key and self._validate_api_key(self.api_key):
            self.client = anthropic.Anthropic(api_key=self.api_key)
            log_app_info("Claude AI client initialized successfully")
        else:
            self.client = None
            if not self.api_key:
                msg = "⚠️  No Claude API key found. Set ANTHROPIC_API_KEY environment variable."
                print(msg)
                log_app_warning("Claude API key not found in environment")
            else:
                msg = "⚠️  Invalid Claude API key format detected."
                print(msg)
                log_app_warning("Invalid Claude API key format")

    def _get_claude_key(self) -> Optional[str]:
        """Get Claude API key from environment variables"""
        possible_keys = [
            "ANTHROPIC_API_KEY",
            "CLAUDE_API_KEY",
            "CLAUDE_KEY"
        ]

        for key_name in possible_keys:
            api_key = os.getenv(key_name)
            if api_key:
                log_app_info(f"Claude API key found in {key_name}")
                return api_key

        log_app_warning("No Claude API key found in environment variables")
        return None

    def _validate_api_key(self, api_key: str) -> bool:
        """Basic validation of Claude API key format"""
        if not api_key:
            return False
        # Claude keys typically start with 'sk-ant-' and are longer
        if api_key.startswith('sk-ant-') and len(api_key) > 50:
            return True
        return False

    def set_api_key(self, api_key: str):
        """Update the API key and recreate client"""
        if self._validate_api_key(api_key):
            self.api_key = api_key
            self.client = anthropic.Anthropic(api_key=api_key)
            log_app_info("Claude API key updated successfully")
            return True
        log_app_warning("Attempted to set invalid Claude API key")
        return False

    def is_available(self) -> bool:
        """Check if AI assistant is ready to use"""
        available = self.client is not None and self.api_key is not None
        if not available and LOGGING_AVAILABLE:
            log_app_warning("AI assistant availability check: NOT AVAILABLE")
        return available

    def _format_response_as_html(self, text: str) -> str:
        """Convert Claude's text response to HTML with proper formatting"""
        lines = text.strip().split('\n')
        html_parts = []
        current_paragraph = []
        in_list = False
        
        for line in lines:
            line = line.strip()
            
            if not line:
                # Empty line - end current paragraph or list
                if current_paragraph:
                    html_parts.append(f"<p class='mb-3'>{''.join(current_paragraph)}</p>")
                    current_paragraph = []
                if in_list:
                    html_parts.append('</ul>')
                    in_list = False
                continue
            
            # Check if line starts with numbered section (e.g., "1. **", "2. **", "3. **")
            if re.match(r'^\d+\.\s+\*\*', line):
                # End previous paragraph/list if exists
                if current_paragraph:
                    html_parts.append(f"<p class='mb-3'>{''.join(current_paragraph)}</p>")
                    current_paragraph = []
                if in_list:
                    html_parts.append('</ul>')
                    in_list = False
                
                # Extract the heading text and format it
                match = re.search(r'^\d+\.\s+\*\*(.+?)\*\*', line)
                if match:
                    heading = match.group(1)
                    html_parts.append(f"<h4 class='font-semibold text-gray-900 mt-4 mb-2 text-lg'>{heading}</h4>")
                    # Get any text after the heading
                    remaining = line[match.end():].strip()
                    if remaining:
                        current_paragraph.append(remaining + ' ')
            
            # Check for bullet points (lines starting with -)
            elif line.startswith('-'):
                if current_paragraph:
                    html_parts.append(f"<p class='mb-3'>{''.join(current_paragraph)}</p>")
                    current_paragraph = []
                
                if not in_list:
                    html_parts.append('<ul class="list-disc ml-6 mb-3 space-y-1">')
                    in_list = True
                
                line_content = line[1:].strip()  # Remove the dash
                # Convert **bold** to <strong>
                line_content = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', line_content)
                html_parts.append(f"<li>{line_content}</li>")
            
            else:
                # Regular text line
                if in_list:
                    html_parts.append('</ul>')
                    in_list = False
                
                # Convert **bold** to <strong>
                line = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', line)
                current_paragraph.append(line + ' ')
        
        # Add any remaining paragraph or close list
        if current_paragraph:
            html_parts.append(f"<p class='mb-3'>{''.join(current_paragraph)}</p>")
        if in_list:
            html_parts.append('</ul>')
        
        return ''.join(html_parts)

    def _make_claude_request(self, system_prompt: str, user_prompt: str, max_tokens: int = 500, question_type: str = "analysis") -> str:
        """Make a request to Claude API with logging"""
        if not self.is_available():
            error_msg = "AI Analysis Error: Claude API key not configured. Please add your API key to enable AI insights."
            log_app_warning(
                f"Claude request attempted but API not available - {question_type}")
            return error_msg

        try:
            log_app_info(
                f"Making Claude API request - Type: {question_type}, Max tokens: {max_tokens}")

            response = self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )

            # Extract response text
            response_text = response.content[0].text

            # Format the response with HTML for better readability
            formatted_response = self._format_response_as_html(response_text)

            # Calculate tokens used
            tokens_used = response.usage.input_tokens + response.usage.output_tokens

            # Log successful call
            log_ai_call(
                question=question_type,
                language="detected from prompt",
                success=True,
                tokens=tokens_used
            )

            log_app_info(
                f"Claude API request successful - {tokens_used} tokens used")

            return formatted_response

        except Exception as e:
            error_msg = f"AI Analysis Error: {str(e)}. Please check your Claude API key and try again."

            # Log failed call
            log_ai_call(
                question=question_type,
                language="detected from prompt",
                success=False,
                error=str(e)
            )

            log_error(
                f"Claude API request failed for {question_type}: {str(e)}", exc_info=True)

            return error_msg

    def _get_language_instruction(self, language: str) -> str:
        """Get language-specific instruction for AI responses"""
        instructions = {
            "italian": """Rispondi SEMPRE in italiano. Usa un tono professionale ma colloquiale, come se stessi consigliando direttamente un imprenditore italiano. 
            Struttura la tua risposta con paragrafi chiari e numerati quando appropriato. Usa terminologia finanziaria appropriata in italiano.
            Formatta la risposta con interruzioni di paragrafo chiare per migliorare la leggibilità.""",
            "spanish": """Responde SIEMPRE en español. Usa un tono profesional pero conversacional, como si estuvieras aconsejando directamente a un empresario español. 
            Estructura tu respuesta con párrafos claros y numerados cuando sea apropiado. Usa terminología financiera apropiada en español.
            Formatea la respuesta con saltos de párrafo claros para mejorar la legibilidad.""",
            "english": """Respond in English with a professional but conversational tone, like you're advising a business owner directly.
            Structure your response with clear, numbered paragraphs when appropriate. Format the response with clear paragraph breaks for readability."""
        }
        return instructions.get(language.lower(), instructions["english"])

    # Methods called by main.py
    def analyze_cash_eaters_insights(self, cash_eaters: List[Dict], low_margin_products: List[Dict], language: str = "English") -> str:
        """Analyze cash flow issues - called by main.py"""
        log_app_info(f"Cash eaters insights requested - Language: {language}")

        language_instruction = self._get_language_instruction(language)
        system_prompt = f"You are an expert retail financial advisor who gives clear, actionable advice. {language_instruction}"

        user_prompt = f"""
Analyze the following business cash flow data:

CASH DRAINS:
{json.dumps(cash_eaters, indent=2)}

LOW MARGIN PRODUCTS:
{json.dumps(low_margin_products, indent=2)}

Provide a structured analysis answering "What's eating my cash flow?" Format your response with:

1. **Biggest cash drain assessment** (2-3 sentences)

2. **Specific actionable recommendations** (3-4 key points)

3. **Quick wins for this week** (immediate actions)

Use clear paragraph breaks between sections for readability.
"""

        return self._make_claude_request(system_prompt, user_prompt, max_tokens=600, question_type="cash_eaters")

    def analyze_reorder_insights(self, reorder_plan: List[Dict], budget: float, language: str = "English") -> str:
        """Analyze reorder recommendations - called by main.py"""
        log_app_info(
            f"Reorder insights requested - Budget: €{budget}, Language: {language}")

        language_instruction = self._get_language_instruction(language)
        system_prompt = f"You are an expert inventory management advisor for retail businesses. {language_instruction}"

        user_prompt = f"""
Based on this reorder plan, provide analysis:

BUDGET: €{budget:,.2f}

RECOMMENDED PURCHASES:
{json.dumps(reorder_plan, indent=2)}

Provide structured analysis for "What should I reorder with my budget?" Format with:

1. **Purchase plan assessment** (2-3 sentences on the overall strategy)

2. **Product prioritization rationale** (why these specific items)

3. **Expected ROI and cash flow impact** (quantified benefits where possible)

4. **Alternative strategies** (other options to consider)

Use clear paragraph breaks between sections. Be specific about financial impact.
"""

        return self._make_claude_request(system_prompt, user_prompt, max_tokens=600, question_type="reorder_plan")

    def analyze_executive_insights(self, snapshot: Dict, language: str = "English") -> str:
        """Generate executive summary - called by main.py"""
        log_app_info(f"Executive insights requested - Language: {language}")

        language_instruction = self._get_language_instruction(language)
        system_prompt = f"You are a senior business consultant providing executive-level retail insights. {language_instruction}"

        user_prompt = f"""
Provide a brief executive summary based on this business snapshot:

BUSINESS SNAPSHOT:
{json.dumps(snapshot, indent=2)}

Provide:
1. **Key business health indicators** (2-3 sentences)
2. **Top 2 opportunities for improvement**
3. **Critical action item for this week**

Keep it concise and executive-focused with clear paragraph breaks.
"""

        return self._make_claude_request(system_prompt, user_prompt, max_tokens=350, question_type="executive_insights")

    # Original methods for backwards compatibility
    def analyze_cash_eaters(self, business_context: str, cash_eaters_data: Dict, language: str = "english") -> str:
        """AI analysis of what's eating cash flow - original method"""
        log_app_info(f"Cash eaters analysis (original) - Language: {language}")

        language_instruction = self._get_language_instruction(language)
        system_prompt = f"You are an expert retail financial advisor who gives clear, actionable advice. {language_instruction}"

        user_prompt = f"""
Analyze the following business data and cash flow issues:

{business_context}

CASH FLOW ANALYSIS DATA:
Discounts: €{cash_eaters_data.get('discounts', 0):,.2f}
Refunds: €{cash_eaters_data.get('refunds', 0):,.2f}
Processor Fees: €{cash_eaters_data.get('processor_fees', 0):,.2f}

LOWEST MARGIN PRODUCTS:
{cash_eaters_data.get('low_margin_products', 'No data available')}

Provide a structured analysis answering "What's eating my cash flow?" Format your response with:

1. **Biggest cash drain assessment** (2-3 sentences)

2. **Specific actionable recommendations** (3-4 key points)

3. **Quick wins for this week** (immediate actions)

Use clear paragraph breaks between sections for readability.
"""

        return self._make_claude_request(system_prompt, user_prompt, max_tokens=600, question_type="cash_eaters")

    def analyze_reorder_plan(self, business_context: str, reorder_data: Dict, budget: float, language: str = "english") -> str:
        """AI analysis of reorder recommendations - original method"""
        log_app_info(
            f"Reorder analysis (original) - Budget: €{budget}, Language: {language}")

        language_instruction = self._get_language_instruction(language)
        system_prompt = f"You are an expert inventory management advisor for retail businesses. {language_instruction}"

        user_prompt = f"""
Based on this business data, analyze the reorder plan:

{business_context}

REORDER PLAN ANALYSIS:
Budget: €{budget:,.2f}
Remaining Budget: €{reorder_data.get('remaining_budget', 0):,.2f}

RECOMMENDED PURCHASES:
{reorder_data.get('purchase_plan', 'No recommendations available')}

Provide structured analysis for "What should I reorder with my budget?" Format with:

1. **Purchase plan assessment** (2-3 sentences on the overall strategy)

2. **Product prioritization rationale** (why these specific items)

3. **Expected ROI and cash flow impact** (quantified benefits where possible)

4. **Alternative strategies** (other options to consider)

Use clear paragraph breaks between sections. Be specific about financial impact.
"""

        return self._make_claude_request(system_prompt, user_prompt, max_tokens=600, question_type="reorder_plan")

    def generate_executive_insights(self, business_context: str) -> str:
        """Generate high-level executive insights - original method"""
        log_app_info("Executive insights (original) requested")

        system_prompt = "You are a senior business consultant providing executive-level retail insights."

        user_prompt = f"""
Provide a brief executive summary based on this business data:

{business_context}

Provide:
1. **Key business health indicators** (2-3 sentences)
2. **Top 2 opportunities for improvement**
3. **Critical action item for this week**

Keep it concise and executive-focused with clear paragraph breaks.
"""

        return self._make_claude_request(system_prompt, user_prompt, max_tokens=350, question_type="executive_insights")