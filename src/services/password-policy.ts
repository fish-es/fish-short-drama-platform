export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_REQUIREMENT_MESSAGE = '密码过于简单：至少 12 位，并同时包含大写字母、小写字母和数字'

export function meetsPasswordRequirements(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /\d/.test(password)
}
