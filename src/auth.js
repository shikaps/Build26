function profileFromEmail(email) {
  const localPart = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  const name = localPart.split(/\s+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") || "Student";
  return {
    id: `session-${email.toLowerCase()}`,
    name,
    email,
    initials: name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    color: "violet",
  };
}

function validateEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
}

export const mockAuth = {
  async login({ email, password, users }) {
    const normalizedEmail = email.trim().toLowerCase();
    validateEmail(normalizedEmail);
    if (!password) throw new Error("Enter your password to continue.");
    return users.find((user) => user.email?.toLowerCase() === normalizedEmail) || profileFromEmail(normalizedEmail);
  },

  async register({ name, email, password, confirmPassword }) {
    const cleanName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (!cleanName) throw new Error("Enter your name.");
    validateEmail(normalizedEmail);
    if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
    if (password !== confirmPassword) throw new Error("Your passwords do not match.");
    return {
      ...profileFromEmail(normalizedEmail),
      name: cleanName,
      initials: cleanName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    };
  },
};
