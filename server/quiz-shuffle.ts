/**
 * Quiz shuffling functionality to ensure different trainees see questions and options in different orders
 */

/**
 * HARDCODED SHUFFLE PATTERNS
 * This guarantees different orders for different users by using precomputed patterns
 * Each user will get a pattern based on the modulo of their user ID
 */
const SHUFFLE_PATTERNS = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], // original order
  [9, 0, 1, 2, 3, 4, 5, 6, 7, 8], // rotate right
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 0], // rotate left
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0], // reverse
  [0, 2, 4, 6, 8, 1, 3, 5, 7, 9], // evens then odds
  [1, 3, 5, 7, 9, 0, 2, 4, 6, 8], // odds then evens
  [0, 9, 1, 8, 2, 7, 3, 6, 4, 5], // alternating from ends
  [4, 5, 6, 7, 8, 9, 0, 1, 2, 3], // middle-out pattern
  [5, 3, 1, 0, 2, 4, 6, 8, 7, 9], // random pattern 1
  [8, 4, 0, 6, 2, 9, 5, 1, 7, 3]  // random pattern 2
];

/**
 * Creates an explicitly different order for each user ID
 * 
 * @param array The array to shuffle
 * @param userId The user ID to determine shuffle pattern
 * @returns A new shuffled array
 */
export function shuffleArrayWithSeed<T>(array: T[], seed: string): T[] {
  const userId = parseInt(seed.split('-')[1] || '0');
  
  // If array has only 0 or 1 elements, no shuffling needed
  if (array.length <= 1) {
    console.log('Array too small to shuffle');
    return [...array];
  }
  
  console.log(`Shuffling array for user ID: ${userId}, array length: ${array.length}`);
  
  // Make a deep copy of the original array
  const newArray = JSON.parse(JSON.stringify(array));
  
  // Select a shuffle pattern based on the user ID
  // Using modulo to cycle through available patterns
  const patternIndex = userId % SHUFFLE_PATTERNS.length;
  const selectedPattern = SHUFFLE_PATTERNS[patternIndex];
  
  console.log(`Using shuffle pattern #${patternIndex}`);
  
  // Apply the selected pattern to reorder the array
  const result: T[] = [];
  
  for (let i = 0; i < array.length; i++) {
    // Map the pattern index to the array index
    // If the array is shorter than the pattern, use modulo
    // If the array is longer than the pattern, extend by repeating
    const sourceIndex = selectedPattern[i % selectedPattern.length] % array.length;
    result[i] = newArray[sourceIndex];
  }
  
  // For arrays longer than our patterns, use a secondary shuffle
  if (array.length > SHUFFLE_PATTERNS[0].length) {
    // Create chunks of 10 and apply different patterns to each chunk
    for (let chunk = 1; chunk < Math.ceil(array.length / 10); chunk++) {
      const chunkStart = chunk * 10;
      const chunkEnd = Math.min(chunkStart + 10, array.length);
      const chunkPattern = SHUFFLE_PATTERNS[(patternIndex + chunk) % SHUFFLE_PATTERNS.length];
      
      // Apply the pattern to this chunk
      for (let i = 0; i < (chunkEnd - chunkStart); i++) {
        const localIndex = chunkStart + i;
        const sourceIndex = chunkStart + (chunkPattern[i % chunkPattern.length] % (chunkEnd - chunkStart));
        result[localIndex] = newArray[sourceIndex];
      }
    }
  }
  
  // Log the before/after for debugging
  console.log(`BEFORE: ${JSON.stringify(array.map(x => typeof x === 'object' && x !== null && 'id' in x ? x.id : x))}`);
  console.log(`AFTER:  ${JSON.stringify(result.map(x => typeof x === 'object' && x !== null && 'id' in x ? x.id : x))}`);
  
  return result;
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