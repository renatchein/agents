from dotenv import load_dotenv
from anthropic import Anthropic

load_dotenv()
client = Anthropic()

response = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=100,
    messages=[{"role": "user", "content": "diga: funcionou"}]
)

print(response.content[0].text)