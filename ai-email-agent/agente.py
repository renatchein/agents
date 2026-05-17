import json
import time
import threading
from datetime import datetime
from gmail_connect import conectar_gmail
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()
client = Anthropic()

historico = []
_ids_processados = set()
rodando = False
thread_agente = None

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
    texto = response.content[0].text
    texto_limpo = texto.replace("```json", "").replace("```", "").strip()
    return json.loads(texto_limpo)

def processar_emails(quantidade=5):
    global historico, _ids_processados

    service = conectar_gmail()
    resultado = service.users().messages().list(
        userId='me',
        maxResults=quantidade,
        labelIds=['INBOX']
    ).execute()

    mensagens = resultado.get('messages', [])
    novos = 0

    for msg in mensagens:
        if msg['id'] in _ids_processados:
            continue

        detalhes = service.users().messages().get(
            userId='me',
            id=msg['id'],
            format='full'
        ).execute()

        headers = detalhes['payload']['headers']
        assunto = next((h['value'] for h in headers if h['name'] == 'Subject'), 'Sem assunto')
        remetente = next((h['value'] for h in headers if h['name'] == 'From'), 'Desconhecido')
        trecho = detalhes.get('snippet', '')

        analise = analisar_email(remetente, assunto, trecho)

        historico.append({
            "id": msg['id'],
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "remetente": remetente,
            "assunto": assunto,
            "trecho": trecho,
            **analise
        })

        _ids_processados.add(msg['id'])
        novos += 1

    return novos

def loop_agente(intervalo=60):
    global rodando
    while rodando:
        processar_emails()
        time.sleep(intervalo)

def iniciar(intervalo=60):
    global rodando, thread_agente
    if not rodando:
        rodando = True
        thread_agente = threading.Thread(target=loop_agente, args=(intervalo,), daemon=True)
        thread_agente.start()

def parar():
    global rodando
    rodando = False