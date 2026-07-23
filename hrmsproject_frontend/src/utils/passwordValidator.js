/**
 * Enforces strong password rules:
 * - Minimum length (8+ characters)
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 * - Rejects sequential characters (e.g. 1234, abcd, 12345678)
 * - Rejects repeated characters (e.g. aaaa, 1111)
 * - Rejects common weak passwords (e.g. password, qwerty)
 */
export function validatePassword(password) {
  if (!password) {
    return "Password is required";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number";
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    return "Password must contain at least one special character";
  }
  if (/(.)\1{2,}/i.test(password)) {
    return "Password must not contain repeated characters (e.g. aaaa, 1111)";
  }

  const lower = password.toLowerCase();

  // Check for sequential characters (3+ consecutive ascending or descending alphanumeric chars)
  for (let i = 0; i < lower.length - 2; i++) {
    const c1 = lower.charCodeAt(i);
    const c2 = lower.charCodeAt(i + 1);
    const c3 = lower.charCodeAt(i + 2);

    // Ascending sequence (e.g., 1-2-3 or a-b-c)
    if (c2 === c1 + 1 && c3 === c2 + 1) {
      if ((c1 >= 48 && c3 <= 57) || (c1 >= 97 && c3 <= 122)) {
        return "Password must not contain sequential characters (e.g. 1234 or abcd)";
      }
    }
    // Descending sequence (e.g., 3-2-1 or c-b-a)
    if (c2 === c1 - 1 && c3 === c2 - 1) {
      if ((c3 >= 48 && c1 <= 57) || (c3 >= 97 && c1 <= 122)) {
        return "Password must not contain sequential characters (e.g. 1234 or abcd)";
      }
    }
  }

  // Check keyboard patterns
  const keyboardPatterns = ["qwerty", "wertyu", "ertyui", "rtyuio", "tyuiop", "asdfgh", "sdfghj", "dfghjk", "fghjkl", "zxcvbn", "xcvbnm"];
  for (const pat of keyboardPatterns) {
    for (let i = 0; i <= pat.length - 3; i++) {
      const sub = pat.slice(i, i + 3);
      if (lower.includes(sub)) {
        return "Password must not contain sequential keyboard patterns (e.g. qwerty)";
      }
    }
  }

  // Check common weak passwords
  const commonWeak = ["password", "pass1234", "qwerty", "admin", "admin123", "welcome", "12345678", "123456789", "letmein", "hrms1234", "p@ssword"];
  for (const weak of commonWeak) {
    if (lower.includes(weak)) {
      return "Password is too common or easily guessable";
    }
  }

  return null; // Valid
}
