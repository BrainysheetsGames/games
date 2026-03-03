// math-engine.js

const MathEngine = {
    currentQuestion: null,
    streak: 0,
    baseGoldReward: 25,
    gradeLevel: null, 
    
    generators: {
        2: [
            () => {
                const h = Math.floor(Math.random() * 12) + 1;
                const m = [0, 15, 30, 45][Math.floor(Math.random() * 4)];
                const mStr = m === 0 ? "00" : m;
                const newM = m + 5;
                return {
                    q: `What is 5 min after ${h}:${mStr}?`,
                    a: `${h}:${newM < 10 ? '0'+newM : newM}`,
                    wrong: [`${h}:${mStr}5`, `${h+1}:00`, `${h}:${m-5>0?m-5:'00'}`]
                };
            },
            () => {
                const dimes = Math.floor(Math.random() * 5) + 1;
                const pennies = Math.floor(Math.random() * 9) + 1;
                return {
                    q: `Count: ${dimes} Dimes, ${pennies} Pennies`,
                    a: `${(dimes * 10) + pennies}¢`,
                    wrong: [`${pennies * 10 + dimes}¢`, `${(dimes * 10) + pennies + 10}¢`, `${(dimes * 10) + pennies - 5}¢`]
                };
            }
        ],
        3: [
            () => {
                const w = Math.floor(Math.random() * 5) + 3;
                const l = Math.floor(Math.random() * 5) + 3;
                return {
                    q: `Perimeter of a ${w}x${l} rectangle?`,
                    a: `${2 * (w + l)}`,
                    wrong: [`${w * l}`, `${2 * (w + l) + 2}`, `${w + l}`]
                };
            }
        ],
        4: [
            () => {
                const ft = Math.floor(Math.random() * 5) + 2;
                return {
                    q: `How many inches in ${ft} feet?`,
                    a: `${ft * 12}`,
                    wrong: [`${ft * 10}`, `${ft * 14}`, `${ft * 12 + 2}`]
                };
            }
        ],
        5: [
            () => {
                const l = Math.floor(Math.random() * 4) + 2;
                const w = Math.floor(Math.random() * 4) + 2;
                const h = Math.floor(Math.random() * 4) + 2;
                return {
                    q: `Volume: L=${l}, W=${w}, H=${h}`,
                    a: `${l * w * h}`,
                    wrong: [`${l + w + h}`, `${(l * w * h) + 2}`, `${l * w}`]
                };
            }
        ]
    },

    init: function() {
        this.generateQuestion();
    },

    generateQuestion: function() {
        // Fallback to Grade 3 if missing
        const genList = this.generators[this.gradeLevel] || this.generators[3];
        const randomGen = genList[Math.floor(Math.random() * genList.length)];
        const qData = randomGen();
        
        let options = [qData.a, ...qData.wrong];
        options = options.sort(() => Math.random() - 0.5);

        this.currentQuestion = { question: qData.q, answer: qData.a, options: options };
        this.updateUI();
    },

    updateUI: function() {
        document.getElementById('math-grade-ui').innerText = this.gradeLevel;
        document.getElementById('math-streak-ui').innerText = this.streak;
        document.getElementById('math-question').innerText = this.currentQuestion.question;
        
        const optsContainer = document.getElementById('math-options');
        optsContainer.innerHTML = ''; 
        
        this.currentQuestion.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'math-btn';
            btn.innerText = opt;
            btn.onclick = () => this.checkAnswer(opt);
            optsContainer.appendChild(btn);
        });
    },

    checkAnswer: function(selected) {
        const feedback = document.getElementById('math-feedback');
        
        if (selected === this.currentQuestion.answer) {
            this.streak++;
            let multiplier = 1.0;
            if (this.streak >= 5) multiplier = 1.4;
            else if (this.streak >= 3) multiplier = 1.2;

            const goldEarned = Math.floor(this.baseGoldReward * multiplier);
            Game.addGold(goldEarned);
            
            feedback.style.color = "#2ed573"; 
            feedback.innerText = `Awesome! +${goldEarned} Gold`;
            
            setTimeout(() => {
                feedback.innerText = "";
                this.generateQuestion();
            }, 1000);

        } else {
            this.streak = 0;
            feedback.style.color = "#ff4757";
            feedback.innerText = "Not quite — try again!";
            document.getElementById('math-streak-ui').innerText = this.streak;
        }
    }
};
