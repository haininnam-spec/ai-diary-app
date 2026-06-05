document.addEventListener('DOMContentLoaded', () => {
    const btnVoice = document.getElementById('btn-voice');
    const btnAnalyze = document.getElementById('btn-analyze');
    const diaryInput = document.getElementById('diary-input');
    const aiResponseBox = document.getElementById('ai-response-box');

    // Load from local storage on page load
    const savedDiary = localStorage.getItem('savedDiary');
    const savedAiResponse = localStorage.getItem('savedAiResponse');
    
    if (savedDiary) {
        diaryInput.value = savedDiary;
    }
    if (savedAiResponse) {
        aiResponseBox.innerHTML = savedAiResponse;
    }

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

            // Save to local storage
            localStorage.setItem('savedDiary', content);
            localStorage.setItem('savedAiResponse', formattedText);
        } catch (error) {
            console.error('Error:', error);
            aiResponseBox.innerHTML = '<span style="color: #d9534f;">분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요. 😢</span>';
        } finally {
            btnAnalyze.disabled = false;
        }
    });
});
