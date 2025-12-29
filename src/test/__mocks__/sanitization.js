// Mock sanitization utilities for testing
export const sanitizeInput = (input) => input;
export const sanitizeHtml = (html) => html;
export const validateInput = (input) => ({ isValid: true, sanitized: input });