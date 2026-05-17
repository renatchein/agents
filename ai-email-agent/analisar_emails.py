from gmail_connect import conectar_gmail
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()
client = Anthropic()

def analisar_email(remetente, assunto, trecho):
    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=300,
        messages=[{
            "role": "user",
            "content": f"""Analise este email e responda em JSON com exatamente este formato:
{{
  "prioridade": "alta / média / baixa",
  "categoria": "trabalho / financeiro / pessoal / spam / outro",
  "acao_sugerida": "uma frase curta com o que fazer",
  "resposta_sugerida": "rascunho curto de resposta se necessário, senão null"
}}

Email:
De: {remetente}
Assunto: {assunto}
Trecho: {trecho}"""
        }]
    )
    return response.content[0].text

def processar_caixa_entrada(quantidade=5):
    service = conectar_gmail()

    resultado = service.users().messages().list(
        userId='me',
        maxResults=quantidade,
        labelIds=['INBOX']
    ).execute()

    mensagens = resultado.get('messages', [])

    print(f"\n📬 Processando {len(mensagens)} emails...\n")
    print("=" * 60)

    for msg in mensagens:
        detalhes = service.users().messages().get(
            userId='me',
            id=msg['id'],
            format='full'
        ).execute()

        headers = detalhes['payload']['headers']
        assunto = next((h['value'] for h in headers if h['name'] == 'Subject'), 'Sem assunto')
        remetente = next((h['value'] for h in headers if h['name'] == 'From'), 'Desconhecido')
        trecho = detalhes.get('snippet', '')

        print(f"De: {remetente}")
        print(f"Assunto: {assunto}")

        analise = analisar_email(remetente, assunto, trecho)
        print(f"Análise:\n{analise}")
        print("-" * 60)

if __name__ == "__main__":
    processar_caixa_entrada()