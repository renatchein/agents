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

ESCOPO_SEGUNDOS = {
    "hora": 3600,
    "dia": 86400,
    "semana": 604800,
}


def analisar_email(remetente, assunto, trecho):
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=200,
        messages=[{
            "role": "user",
            "content": f"""Analise este email e responda em JSON com exatamente este formato:
{{
  "prioridade": "alta / média / baixa",
  "categoria": "trabalho / financeiro / pessoal / spam / outro",
  "acao_sugerida": "uma frase curta com o que fazer"
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


def gerar_resposta(email_id):
    email = next((e for e in historico if e['id'] == email_id), None)
    if not email:
        return None

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=500,
        messages=[{
            "role": "user",
            "content": f"""Escreva uma resposta profissional e personalizada para este email.
Responda apenas com o corpo da resposta, sem linhas de assunto ou saudações genéricas.

De: {email['remetente']}
Assunto: {email['assunto']}
Conteúdo: {email['trecho']}
Ação sugerida: {email.get('acao_sugerida', '')}"""
        }]
    )

    resposta = response.content[0].text.strip()
    email['resposta_sugerida'] = resposta
    return resposta


def processar_emails(quantidade=5, escopo="dia"):
    global historico, _ids_processados

    after_epoch = int(time.time()) - ESCOPO_SEGUNDOS.get(escopo, 86400)
    service = conectar_gmail()

    resultado = service.users().threads().list(
        userId='me',
        maxResults=quantidade,
        labelIds=['INBOX'],
        q=f"after:{after_epoch}",
    ).execute()

    threads = resultado.get('threads', [])
    novos = 0

    for t in threads:
        if t['id'] in _ids_processados:
            continue

        thread_data = service.users().threads().get(
            userId='me',
            id=t['id'],
            format='full',
        ).execute()

        messages = thread_data.get('messages', [])
        if not messages:
            continue

        # Skip threads where user already replied last (waiting for response)
        last_labels = messages[-1].get('labelIds', [])
        if 'SENT' in last_labels:
            continue

        first = messages[0]
        headers = first['payload']['headers']
        assunto = next((h['value'] for h in headers if h['name'] == 'Subject'), 'Sem assunto')
        remetente = next((h['value'] for h in headers if h['name'] == 'From'), 'Desconhecido')
        trecho = first.get('snippet', '')

        analise = analisar_email(remetente, assunto, trecho)

        internal_date = int(first.get('internalDate', 0))

        historico.append({
            "id": t['id'],
            "timestamp": datetime.now().strftime("%d/%m %H:%M"),
            "internalDate": internal_date,
            "remetente": remetente,
            "assunto": assunto,
            "trecho": trecho,
            "resposta_sugerida": None,
            **analise,
        })

        _ids_processados.add(t['id'])
        novos += 1

    return novos


def loop_agente(intervalo=60, escopo="dia"):
    global rodando
    while rodando:
        processar_emails(escopo=escopo)
        time.sleep(intervalo)


def iniciar(intervalo=60, escopo="dia"):
    global rodando, thread_agente
    if not rodando:
        rodando = True
        thread_agente = threading.Thread(target=loop_agente, args=(intervalo, escopo), daemon=True)
        thread_agente.start()


def parar():
    global rodando
    rodando = False


def verificar_respondido(thread_id):
    service = conectar_gmail()
    thread_data = service.users().threads().get(
        userId='me',
        id=thread_id,
        format='minimal',
    ).execute()
    messages = thread_data.get('messages', [])
    if not messages:
        return False
    return 'SENT' in messages[-1].get('labelIds', [])
