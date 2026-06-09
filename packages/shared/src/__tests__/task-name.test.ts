import { describe, it, expect } from 'vitest';
import { generateTaskName } from '../task-name.js';

describe('generateTaskName', () => {
  it('returns Untitled task for empty input', () => {
    expect(generateTaskName('')).toBe('Untitled task');
  });

  it('returns Untitled task for whitespace-only input', () => {
    expect(generateTaskName('   ')).toBe('Untitled task');
  });

  it('keeps short descriptions intact', () => {
    expect(generateTaskName('Fix login bug')).toBe('Fix login bug');
  });

  it('strips conversational prefixes', () => {
    expect(generateTaskName('Can you fix the login page?')).toBe('Fix the login page');
    expect(generateTaskName('I want to add dark mode')).toBe('Add dark mode');
    expect(generateTaskName('I need you to write unit tests')).toBe('Write unit tests');
    expect(generateTaskName("I'd like you to implement search")).toBe('Implement search');
    expect(generateTaskName('Please create a landing page')).toBe('Create landing page');
    expect(generateTaskName('Could you update the readme?')).toBe('Update the readme');
    expect(generateTaskName("Let's refactor the auth module")).toBe('Refactor the auth module');
  });

  it('strips "I want you to" prefix', () => {
    expect(generateTaskName('I want you to write a sorting algorithm')).toBe('Write sorting algorithm');
  });

  it('strips "Can I" prefix', () => {
    expect(generateTaskName('Can I get the payment flow working?')).toBe('Get the payment flow working');
  });

  it('extracts first sentence only', () => {
    expect(generateTaskName('Add user authentication. This should use JWT tokens.')).toBe('Add user authentication');
  });

  it('extracts up to first newline', () => {
    expect(generateTaskName('Build a todo app\nwith CRUD operations')).toBe('Build todo app');
  });

  it('removes trailing period', () => {
    expect(generateTaskName('Fix the CSS layout.')).toBe('Fix the CSS layout');
  });

  it('strips bracketed prefixes', () => {
    expect(generateTaskName('[FEATURE] Add dark mode support')).toBe('Add dark mode support');
    expect(generateTaskName('[BUG] User cannot log in')).toBe('User cannot log in');
  });

  it('strips indefinite article "a"/"an" after action verbs', () => {
    expect(generateTaskName('Build a todo app')).toBe('Build todo app');
    expect(generateTaskName('Build an API client')).toBe('Build API client');
    expect(generateTaskName('Create a landing page')).toBe('Create landing page');
    expect(generateTaskName('Implement a caching layer')).toBe('Implement caching layer');
    expect(generateTaskName('Set up a CI/CD pipeline')).toBe('Set up CI/CD pipeline');
  });

  it('keeps "the" and "new" after action verbs', () => {
    expect(generateTaskName('Build the documentation site')).toBe('Build the documentation site');
    expect(generateTaskName('Create new pipeline')).toBe('Create new pipeline');
    expect(generateTaskName('Please create a new API endpoint')).toBe('Create new API endpoint');
  });

  it('truncates long descriptions at 55 chars with word boundary', () => {
    const long = 'This is an extremely long description that should definitely get truncated because it goes way beyond the max length';
    const result = generateTaskName(long);
    expect(result.length).toBeLessThanOrEqual(58);
    expect(result.endsWith('…')).toBe(true);
  });

  it('word-boundary truncates long inputs', () => {
    const s = 'This is a really really really really really long description for testing';
    const result = generateTaskName(s);
    expect(result.length).toBeLessThanOrEqual(58);
    expect(result).not.toContain('testing');
  });

  it('preserves action verbs', () => {
    expect(generateTaskName('Set up the CI/CD pipeline')).toBe('Set up the CI/CD pipeline');
    expect(generateTaskName('Remove unused dependencies')).toBe('Remove unused dependencies');
    expect(generateTaskName('Delete old migration files')).toBe('Delete old migration files');
  });

  it('capitalizes first letter', () => {
    expect(generateTaskName('write tests for the API')).toBe('Write tests for the API');
  });

  it('handles real-world multi-sentence goals', () => {
    const goal = 'Build a full-stack todo list application with React and Node.js. It should have CRUD operations and user authentication.';
    const result = generateTaskName(goal);
    // 64-char string truncated to ~55: "Build full-stack todo list application with React and…"
    expect(result.length).toBeLessThanOrEqual(60);
    expect(result).toMatch(/^Build full-stack todo list application/);
    expect(result).toContain('…');
  });

  it('handles no-verb descriptions', () => {
    expect(generateTaskName('Dark mode for the dashboard')).toBe('Dark mode for the dashboard');
  });

  it('strips trailing punctuation', () => {
    expect(generateTaskName('Fix the bug!!')).toBe('Fix the bug');
  });
});
