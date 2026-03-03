// math-engine.js
// Handles question generation, grading, and the 'Gold' economy.

const MathEngine = {
    currentQuestion: null,
    streak: 0,
    baseGoldReward: 25,
    gradeLevel: 3, // Defaulting to 3rd grade logic
    
    // Grade specific generators
    generators: {
        2: [
            () => {
                const h = Math.floor(Math.random() * 12) + 1;
                const m = [0, 15, 30, 45][Math.floor(Math.random() * 4)];
                const mStr = m === 0 ? "00" : m;
                const minAdd = 5;
                const newM = m + minAdd;
                return {
                    q: `What is 5 minutes after ${h}:${mStr}?`,
                    a: `${h}:${newM < 10 ? '0'+newM : newM}`,
                    wrong: [`${h}:${mStr}5`, `${h+1}:00`, `${h}:${m-5>0?m-5:'00'}`]
                };
            },
            () => {
                const dimes = Math.floor(Math.random() * 5) + 1;
                const pennies = Math.floor(Math.random() * 9) + 1;
                const total = (dimes * 10) + pennies;
                return {
                    q: `Count: ${dimes} Dimes, ${pennies} Pennies`,
                    a: `${total}¢`,
                    wrong: [`${pennies * 10 + dimes}¢`, `${total + 10}¢`, `${total - 5}¢`]
                };
            }
        ],
        3: [
            () => {
                const w = Math.floor(Math.random() * 5) + 3;
                const l = Math.floor(Math.random() * 5) + 3;
                const perim = 2 * (w + l);
                return {
                    q: `Perimeter of a ${w}x${l} rectangle?`,
                    a: `${perim}`,
                    wrong: [`${w * l}`, `${perim + 2}`, `${w + l}`]
                };
            },
            () => {
                const gallons = Math.floor(Math.random() * 4) + 1;
                return {
                    q: `How many quarts in ${gallons} gallon(s)?`,
                    a: `${gallons * 4}`,
                    wrong: [`${gallons * 2}`, `${gallons * 8}`, `${gallons * 3}`]
                };
            }
        ]
        // You can add Grade 4 and 5 arrays here
    },

    init: function() {
        this.generateQuestion();
    },

    generateQuestion: function() {
        // Pick a generator based on grade
        const genList = this.generators[this.gradeLevel] || this.generators[3];
        const randomGen = genList[Math.floor(Math.random() * genList.length)];
        
        const qData = randomGen();
        
        // Build multiple choice array
        let options = [qData.a, ...qData.wrong];
        // Shuffle array
        options = options.sort(() => Math.random() - 0.5);

        this.currentQuestion = {
            question: qData.q,
            answer: qData.a,
            options: options
        };

        this.updateUI();
    },

    updateUI: function() {
        document.getElementById('math-grade-ui').innerText = this.gradeLevel;
        document.getElementById('math-streak-ui').innerText = this.streak;
        document.getElementById('math-question').innerText = this.currentQuestion.question;
        
        const optsContainer = document.getElementById('math-options');
        optsContainer.innerHTML = ''; // Clear old buttons
        
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
            // Correct logic
            this.streak++;
            let multiplier = 1.0;
            if (this.streak >= 5) multiplier = 1.4;
            else if (this.streak >= 3) multiplier = 1.2;

            const goldEarned = Math.floor(this.baseGoldReward * multiplier);
            Game.addGold(goldEarned);
            
            feedback.style.color = "#4CAF50"; // Greenish
            feedback.innerText = `Awesome! +${goldEarned} Gold`;
            
            // Wait slightly, then new question
            setTimeout(() => {
                feedback.innerText = "";
                this.generateQuestion();
            }, 1000);

        } else {
            // Incorrect logic (No penalty, reset streak, gentle phrasing)
            this.streak = 0;
            feedback.style.color = "#ff6b81";
            feedback.innerText = "Not quite — try again!";
            document.getElementById('math-streak-ui').innerText = this.streak;
        }
    }
};
