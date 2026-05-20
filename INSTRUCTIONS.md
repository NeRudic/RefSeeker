Create a Python script using browser-use library for finding and downloading reference images.

TASK:

- Accept a search query from user via terminal input
- Use browser-use with GPT-4o mini to browse the web and find reference images
- Download found images to ./references/{query_name}/ folder
- Filter out low quality, watermarked, or irrelevant images using vision capabilities

TECHNICAL REQUIREMENTS:

- Use browser-use library
- LLM: OpenAI GPT-4o mini (model: "gpt-4o-mini")
- API key loaded from .env file as OPENAI_API_KEY
- Save images to ./references/{query_name}/
- Print progress to console
- Handle errors gracefully (site unavailable, failed download, etc.)

AGENT BEHAVIOR:

- Search query format: "{user_query} reference photos high quality"
- Prioritize sites with multiple angles of the same subject
- Skip Pinterest, social media, sites requiring login
- Target: minimum 10, maximum 30 images
- Stop when enough quality images are collected

DEPENDENCIES:

- browser-use
- openai
- python-dotenv
- playwright (chromium)

Provide complete working code in a single main.py file.
Include a requirements.txt file.
