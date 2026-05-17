import streamlit as st
import agente
import time

st.set_page_config(page_title="AI Email Agent", page_icon="📬", layout="wide")

st.title("📬 AI Email Agent")

if "historico" not in st.session_state:
    st.session_state.historico = []

if "rodando" not in st.session_state:
    st.session_state.rodando = False

col1, col2, col3 = st.columns([2, 1, 1])

with col1:
    intervalo = st.slider("Verificar a cada (segundos)", 30, 300, 60, step=30)

with col2:
    if st.button("▶ Iniciar Agente", use_container_width=True):
        st.session_state.rodando = True

with col3:
    if st.button("⏹ Parar Agente", use_container_width=True):
        st.session_state.rodando = False

status = "🟢 Rodando" if st.session_state.rodando else "🔴 Parado"
st.caption(f"Status: {status} — {len(st.session_state.historico)} emails processados")

st.divider()

if st.session_state.rodando:
    with st.spinner("Buscando e analisando emails..."):
        novos = agente.processar_emails(quantidade=5)
        st.session_state.historico = agente.historico
        if novos > 0:
            st.success(f"{novos} novo(s) email(s) processado(s)!")
        else:
            st.info("Nenhum email novo encontrado.")

cores_prioridade = {"alta": "🔴", "média": "🟡", "baixa": "🟢"}
cores_categoria = {
    "trabalho": "🔵",
    "financeiro": "💰",
    "pessoal": "👤",
    "spam": "🗑️",
    "outro": "⚪"
}

if not st.session_state.historico:
    st.info("Nenhum email processado ainda. Clique em Iniciar Agente.")
else:
    emails_ordenados = sorted(
        st.session_state.historico,
        key=lambda x: ["alta", "média", "baixa"].index(x.get("prioridade", "baixa"))
    )

    for i, email in enumerate(emails_ordenados):
        prioridade = email.get("prioridade", "baixa")
        categoria = email.get("categoria", "outro")
        icone_p = cores_prioridade.get(prioridade, "⚪")
        icone_c = cores_categoria.get(categoria, "⚪")

        with st.expander(f"{icone_p} {email['assunto']} — {email['remetente']} ({email['timestamp']})"):
            col_a, col_b = st.columns(2)

            with col_a:
                st.markdown(f"**Prioridade:** {icone_p} {prioridade.capitalize()}")
                st.markdown(f"**Categoria:** {icone_c} {categoria.capitalize()}")
                st.markdown(f"**Ação:** {email.get('acao_sugerida', '—')}")

            with col_b:
                resposta = email.get("resposta_sugerida")
                if resposta:
                    st.markdown("**Rascunho de resposta:**")
                    st.text_area("", value=resposta, height=100, key=f"resposta_{i}")
                else:
                    st.caption("Nenhuma resposta necessária.")

            st.caption(f"Trecho: {email.get('trecho', '')[:150]}")

if st.session_state.rodando:
    time.sleep(intervalo)
    st.rerun()