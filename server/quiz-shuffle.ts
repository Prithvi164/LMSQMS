/**
 * Quiz shuffling functionality to ensure different trainees see questions and options in different orders
 */

/**
 * Creates a deterministic but random order based on a seed string.
 * Same seed will always produce the same shuffle pattern.
 * This ensures a trainee gets a consistent experience if they refresh the page,
 * but different trainees will see different orderings.
 * 
 * @param array The array to shuffle
 * @param seed A string seed used to generate the shuffled order
 * @returns A new shuffled array
 */
export function shuffleArrayWithSeed<T>(array: T[], seed: string): T[] {
  // If array has only 0 or 1 elements, no shuffling needed
  if (array.length <= 1) {
    console.log('Array too small to shuffle');
    return [...array];
  }
  
  // Enhanced seed to force different shuffles between users
  // Add a prefix to ensure the seed creates enough variation
  const enhancedSeed = `shuffle-v3-${seed}`;
  
  console.log(`Shuffling array with seed "${enhancedSeed}", array length: ${array.length}`);
  const newArray = [...array];
  
  // Create a seeded random number generator based on xorshift128+
  // This provides better statistical randomness compared to simpler methods
  function xorshift128plus(seedStr: string): () => number {
    let s1 = 1;
    let s2 = 2;
    
    // Use the seed to initialize the state
    for (let i = 0; i < seedStr.length; i++) {
      s1 = ((s1 * 33) + seedStr.charCodeAt(i)) >>> 0;
      s2 = ((s2 * 37) + (seedStr.charCodeAt(i) << (i % 16))) >>> 0;
    }
    
    // Ensure we don't have zero states
    if (s1 === 0) s1 = 123456789;
    if (s2 === 0) s2 = 987654321;
    
    // Return the random function
    return function() {
      // Xorshift128+ algorithm
      let x = s1;
      const y = s2;
      s1 = y;
      x ^= x << 23;
      x ^= x >>> 17;
      x ^= y;
      x ^= y >>> 26;
      s2 = x;
      return (s1 + s2) / 4294967296;
    };
  }
  
  // Create the random generator with our seed
  const random = xorshift128plus(enhancedSeed);
  
  // Fisher-Yates shuffle with seeded random
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  
  // Log the before/after for debugging
  console.log(`BEFORE: ${JSON.stringify(array.map(x => typeof x === 'object' && x !== null && 'id' in x ? x.id : x))}`);
  console.log(`AFTER:  ${JSON.stringify(newArray.map(x => typeof x === 'object' && x !== null && 'id' in x ? x.id : x))}`);
  
  return newArray;
}

/**
 * Processes a quiz by applying shuffling to questions and options if enabled.
 * This function creates a copy of the quiz data, so the original is not modified.
 * 
 * @param quiz The original quiz object with questions
 * @param template The quiz template with shuffle settings
 * @param userId The ID of the user taking the quiz (used as seed)
 * @returns A processed quiz with shuffled questions and/or options
 */
export function processQuizForTrainee(quiz: any, template: any, userId: number): any {
  if (!quiz || !quiz.questions || !Array.isArray(quiz.questions)) {
    console.log('Invalid quiz data for shuffling');
    return quiz;
  }

  // Create a deep copy of the quiz to avoid modifying the original
  const processedQuiz = JSON.parse(JSON.stringify(quiz));
  
  // Create a unique seed for this user and quiz combination
  // Include a timestamp component to create different shuffles on different days
  // This is useful for environments where multiple trainees may share a computer
  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const uniqueQuizSeed = `user-${userId}-quiz-${quiz.id}-date-${dateStr}`;
  
  console.log('=== QUIZ SHUFFLE PROCESSING ===');
  console.log(`Processing quiz ID ${quiz.id} for user ID ${userId}`);
  console.log(`Original question count: ${quiz.questions.length}`);
  
  // Determine shuffle settings from template
  // Handle both camelCase and snake_case property names for compatibility
  const shuffleQuestions = Boolean(template?.shuffleQuestions || template?.shuffle_questions);
  const shuffleOptions = Boolean(template?.shuffleOptions || template?.shuffle_options);
  
  console.log(`Shuffle settings: questions=${shuffleQuestions}, options=${shuffleOptions}`);
  
  // Shuffle the questions if enabled
  if (shuffleQuestions) {
    console.log('Shuffling questions...');
    processedQuiz.questions = shuffleArrayWithSeed(processedQuiz.questions, uniqueQuizSeed);
  }
  
  // Shuffle the options in each multiple-choice question if enabled
  if (shuffleOptions) {
    console.log('Shuffling options for multiple-choice questions...');
    
    processedQuiz.questions = processedQuiz.questions.map((question: any, index: number) => {
      // Only shuffle options for multiple-choice questions
      if (question.type === 'multiple_choice' && Array.isArray(question.options) && question.options.length > 1) {
        // Create a unique seed for each question to ensure different patterns
        const questionSeed = `${uniqueQuizSeed}-question-${question.id}-${index}`;
        
        // Get original options before shuffling
        const originalOptions = [...question.options];
        const shuffledOptions = shuffleArrayWithSeed([...originalOptions], questionSeed);
        
        // Handle the correctAnswer if it's an index into the options array
        let updatedCorrectAnswer = question.correctAnswer;
        if (!isNaN(Number(question.correctAnswer))) {
          // If it's a numeric index, we need to update it to match the new position
          const correctOptionValue = originalOptions[Number(question.correctAnswer)];
          updatedCorrectAnswer = String(shuffledOptions.indexOf(correctOptionValue));
          
          console.log(`Question ${question.id}: correctAnswer updated from ${question.correctAnswer} to ${updatedCorrectAnswer}`);
        }
        
        // Return the question with shuffled options
        return {
          ...question,
          options: shuffledOptions,
          correctAnswer: updatedCorrectAnswer
        };
      }
      
      // Return other question types unchanged
      return question;
    });
  }
  
  console.log(`Processed quiz has ${processedQuiz.questions.length} questions`);
  return processedQuiz;
}