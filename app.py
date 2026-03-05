import streamlit as st
import requests
import base64

# अपने Render बैकएंड का URL डालें
BACKEND_URL = "https://sahchar-omni-backend.onrender.com"

st.set_page_config(page_title="CSC अलीपुर चैटबॉट", page_icon="💬")
st.title("💬 CSC अलीपुर - सहचर AI")

# सत्र स्टेट में मैसेज स्टोर करें
if "messages" not in st.session_state:
    st.session_state.messages = []

# पुराने मैसेज दिखाएँ
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.write(msg["content"])

# यूजर इनपुट
if prompt := st.chat_input("अपना संदेश लिखें..."):
    # यूजर मैसेज दिखाएँ
    with st.chat_message("user"):
        st.write(prompt)
    st.session_state.messages.append({"role": "user", "content": prompt})

    # बैकएंड से रिस्पॉन्स लें
    with st.chat_message("assistant"):
        with st.spinner("सोच रहा हूँ..."):
            try:
                response = requests.post(
                    f"{BACKEND_URL}/chat",
                    json={"message": prompt},
                    headers={"Content-Type": "application/json"}
                )
                if response.status_code == 200:
                    reply = response.json().get("reply", "कोई जवाब नहीं मिला")
                    st.write(reply)
                    st.session_state.messages.append({"role": "assistant", "content": reply})
                else:
                    st.error(f"एरर: {response.status_code}")
            except Exception as e:
                st.error(f"बैकएंड से कनेक्ट नहीं हो सका: {e}")

# साइडबार में ऑडियो ट्रांसक्रिप्शन (अगर चाहें तो)
with st.sidebar:
    st.header("🎤 ऑडियो ट्रांसक्रिप्शन")
    uploaded_file = st.file_uploader("ऑडियो फाइल अपलोड करें", type=["mp3", "wav", "m4a"])
    if uploaded_file is not None:
        with st.spinner("ट्रांसक्राइब हो रहा है..."):
            files = {"audio": (uploaded_file.name, uploaded_file.getvalue(), uploaded_file.type)}
            try:
                res = requests.post(f"{BACKEND_URL}/api/audio/transcribe", files=files)
                if res.status_code == 200:
                    st.success("ट्रांसक्रिप्शन:")
                    st.write(res.json().get("transcription", ""))
                else:
                    st.error("ट्रांसक्रिप्शन फेल")
            except Exception as e:
                st.error(f"एरर: {e}")

st.caption("पावर्ड बाय DeepSeek AI और CSC अलीपुर")