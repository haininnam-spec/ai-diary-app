document.addEventListener('DOMContentLoaded', () => {
    const btnVoice = document.getElementById('btn-voice');
    const btnAnalyze = document.getElementById('btn-analyze');
    const diaryInput = document.getElementById('diary-input');
    const aiResponseBox = document.getElementById('ai-response-box');

    let supabaseClient;
    let currentSession = null;

    // Initialize Auth
    initAuth();

    async function initAuth() {
        try {
            const baseUrl = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';
            const res = await fetch(`${baseUrl}/api/config`);
            const config = await res.json();
            
            if (config.supabaseUrl && config.supabaseAnonKey) {
                supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
                
                supabaseClient.auth.onAuthStateChange((event, session) => {
                    currentSession = session;
                    if (session) {
                        // 로그인 된 사용자의 이메일을 상단에 표시
                        const emailDisplay = document.getElementById('user-email-display');
                        if (emailDisplay) emailDisplay.textContent = session.user.email;
                        
                        document.getElementById('login-container').style.display = 'none';
                        document.getElementById('app-container').style.display = 'block';
                        fetchHistory();
                        setupRealtimeChat();
                    } else {
                        document.getElementById('login-container').style.display = 'block';
                        document.getElementById('app-container').style.display = 'none';
                    }
                });
            }
        } catch (e) {
            console.error("Failed to initialize Auth", e);
        }
    }

    // Auth Button Listeners
    document.getElementById('btn-login').addEventListener('click', async () => {
        const email = document.getElementById('email-input').value;
        const password = document.getElementById('password-input').value;
        if(!email || !password) return alert('이메일과 비밀번호를 입력해주세요.');
        
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) alert('로그인 실패: ' + error.message);
    });

    document.getElementById('btn-signup').addEventListener('click', async () => {
        const email = document.getElementById('email-input').value;
        const password = document.getElementById('password-input').value;
        if(!email || !password) return alert('이메일과 비밀번호를 입력해주세요.');
        
        const { error } = await supabaseClient.auth.signUp({ email, password });
        if (error) alert('회원가입 실패: ' + error.message);
        else alert('가입 확인 이메일을 확인해 주세요');
    });

    document.getElementById('btn-google-login').addEventListener('click', async () => {
        try {
            const { data, error } = await supabaseClient.auth.signInWithOAuth({ 
                provider: 'google',
                options: {
                    redirectTo: window.location.origin
                }
            });
            if (error) {
                console.error('구글 로그인 에러:', error);
                alert('구글 로그인 실패: ' + error.message);
            }
        } catch (err) {
            console.error('구글 로그인 예외 발생:', err);
            alert('구글 로그인 중 오류가 발생했습니다.');
        }
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
    });

    let recognition;
    let isRecognizing = false;
    let originalText = '';

    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'ko-KR';

        recognition.onstart = () => {
            isRecognizing = true;
            btnVoice.innerHTML = '<span class="icon">🔴</span> 음성 인식 중...';
            originalText = diaryInput.value;
            if (originalText.length > 0 && !originalText.endsWith(' ') && !originalText.endsWith('\n')) {
                originalText += ' ';
            }
        };

        recognition.onresult = (event) => {
            let currentTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                currentTranscript += event.results[i][0].transcript;
            }
            diaryInput.value = originalText + currentTranscript;
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            if (isRecognizing) recognition.stop();
        };

        recognition.onend = () => {
            isRecognizing = false;
            btnVoice.innerHTML = '<span class="icon">🎙️</span> 음성으로 입력';
            // Update original text to what we just finished with so next start appends properly
            originalText = diaryInput.value;
        };
    }

    btnVoice.addEventListener('click', () => {
        if (!recognition) {
            alert('이 브라우저는 음성 인식을 지원하지 않습니다. 크롬(Chrome) 브라우저를 사용해주세요.');
            return;
        }

        if (isRecognizing) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });

    btnAnalyze.addEventListener('click', async () => {
        const content = diaryInput.value.trim();
        
        if (!content) {
            alert('일기 내용을 먼저 입력해주세요.');
            diaryInput.focus();
            return;
        }

        // Show loading state
        btnAnalyze.disabled = true;
        aiResponseBox.innerHTML = '<span style="color: #888;">AI가 일기를 분석하고 있습니다... ✨</span>';
        
        try {
            // 로컬 파일(file://)로 열었을 경우 로컬 테스트 서버(localhost:3000)를 바라보게 하고,
            // Vercel 환경일 경우 상대 경로(/api/analyze)를 사용하도록 동적 처리합니다.
            const apiUrl = window.location.protocol === 'file:' 
                ? 'http://localhost:3000/api/analyze' 
                : '/api/analyze';

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': currentSession ? `Bearer ${currentSession.access_token}` : ''
                },
                body: JSON.stringify({ text: content })
            });

            if (!response.ok) {
                throw new Error('서버 응답 오류');
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            // Convert newlines to <br> for HTML display
            const formattedText = data.result.replace(/\n/g, '<br>');
            aiResponseBox.innerHTML = formattedText;

            // 분석 완료 후 입력창 초기화
            diaryInput.value = '';
            
            // 새 일기 작성 후 히스토리 갱신
            fetchHistory();
        } catch (error) {
            console.error('Error:', error);
            aiResponseBox.innerHTML = '<span style="color: #d9534f;">분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요. 😢</span>';
        } finally {
            btnAnalyze.disabled = false;
        }
    });

    async function fetchHistory() {
        const historyContainer = document.getElementById('history-container');
        if (!historyContainer) return;
        
        try {
            const apiUrl = window.location.protocol === 'file:' 
                ? 'http://localhost:3000/api/history' 
                : '/api/history';

            const response = await fetch(apiUrl, {
                headers: {
                    'Authorization': currentSession ? `Bearer ${currentSession.access_token}` : ''
                }
            });
            if (!response.ok) throw new Error('히스토리 불러오기 실패');
            
            const data = await response.json();
            
            if (!data.history || data.history.length === 0) {
                historyContainer.innerHTML = '<p style="text-align:center; color:#888;">아직 작성된 일기 히스토리가 없습니다.</p>';
                return;
            }

            historyContainer.innerHTML = ''; // Clear container

            data.history.forEach(item => {
                const dateObj = new Date(item.timestamp);
                const dateStr = dateObj.toLocaleString('ko-KR', { 
                    year: 'numeric', month: 'long', day: 'numeric', 
                    hour: '2-digit', minute: '2-digit' 
                });

                const formattedText = item.originalText ? item.originalText.replace(/\n/g, '<br>') : '';
                const formattedAi = item.aiResponse ? item.aiResponse.replace(/\n/g, '<br>') : '';

                const card = document.createElement('div');
                card.className = 'history-card';
                card.innerHTML = `
                    <div class="history-date">${dateStr}</div>
                    <div class="history-text">${formattedText}</div>
                    <div class="history-ai"><strong>AI:</strong><br>${formattedAi}</div>
                `;
                historyContainer.appendChild(card);
            });
        } catch (error) {
            console.error('History Fetch Error:', error);
            historyContainer.innerHTML = '<p style="text-align:center; color:#d9534f;">히스토리를 불러오지 못했습니다.</p>';
        }
    }

    // --- 실시간 채팅 로직 시작 ---
    const chatInput = document.getElementById('chat-input');
    const btnChatSend = document.getElementById('btn-chat-send');
    const chatMessages = document.getElementById('chat-messages');
    let chatSubscription = null;

    function renderChatMessage(msg, isHistory = false) {
        const isMe = currentSession && currentSession.user.email === msg.user_email;
        const div = document.createElement('div');
        div.className = `chat-message ${isMe ? 'me' : 'other'}`;
        
        // 익명 처리 (이메일 앞자리 활용)
        const emailPrefix = msg.user_email ? msg.user_email.split('@')[0] : '익명';
        const senderHtml = isMe ? '' : `<span class="sender">${emailPrefix}</span>`;
        
        div.innerHTML = `${senderHtml}${msg.content}`;
        
        if (isHistory) {
            // 과거 메시지는 맨 앞에 추가
            const firstChild = chatMessages.children[1]; // system message is [0]
            if (firstChild) {
                chatMessages.insertBefore(div, firstChild);
            } else {
                chatMessages.appendChild(div);
            }
        } else {
            chatMessages.appendChild(div);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    async function loadChatHistory() {
        if (!supabaseClient) return;
        const { data, error } = await supabaseClient
            .from('messages')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);
            
        if (!error && data) {
            data.reverse().forEach(msg => renderChatMessage(msg));
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    function setupRealtimeChat() {
        if (!supabaseClient) return;
        
        // 이전 구독이 있다면 취소
        if (chatSubscription) supabaseClient.removeChannel(chatSubscription);

        chatSubscription = supabaseClient.channel('public:messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
                renderChatMessage(payload.new);
            })
            .subscribe();
            
        loadChatHistory();
    }

    async function sendChatMessage() {
        const text = chatInput.value.trim();
        if (!text || !supabaseClient || !currentSession) return;
        
        chatInput.value = '';
        
        const { error } = await supabaseClient
            .from('messages')
            .insert([{
                content: text,
                user_email: currentSession.user.email
            }]);
            
        if (error) {
            console.error('Chat Send Error:', error);
            alert('메시지 전송에 실패했습니다.');
        }
    }

    btnChatSend.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
    // --- 실시간 채팅 로직 끝 ---

});
