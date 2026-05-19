from typing import Literal
from fastapi import FastAPI, HTTPException, Path
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import agente

app = FastAPI(title="Quick Mail API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

_ID_PATTERN = r"^[a-zA-Z0-9]+$"


@app.get("/api/status")
def get_status():
    return {
        "running": agente.rodando,
        "total": len(agente.historico),
    }


@app.get("/api/emails")
def get_emails():
    return agente.historico


class StartRequest(BaseModel):
    quantidade: int = Field(default=5, ge=1, le=50)
    intervalo: int = Field(default=60, ge=30, le=3600)
    escopo: Literal["hora", "dia", "semana"] = "dia"


@app.post("/api/start")
def start_agent(req: StartRequest = StartRequest()):
    try:
        novos = agente.processar_emails(quantidade=req.quantidade, escopo=req.escopo)
        if not agente.rodando:
            agente.iniciar(intervalo=req.intervalo, escopo=req.escopo)
        return {"novos": novos, "total": len(agente.historico)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/stop")
def stop_agent():
    agente.parar()
    return {"ok": True}


@app.get("/api/emails/{email_id}/respondido")
def check_respondido(email_id: str = Path(pattern=_ID_PATTERN)):
    try:
        return {"respondido": agente.verificar_respondido(email_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/emails/{email_id}/resposta")
def post_gerar_resposta(email_id: str = Path(pattern=_ID_PATTERN)):
    try:
        resposta = agente.gerar_resposta(email_id)
        if resposta is None:
            raise HTTPException(status_code=404, detail="Email não encontrado")
        return {"resposta": resposta}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
