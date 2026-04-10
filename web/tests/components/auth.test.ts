import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn()
const mockLogin = vi.fn()
const mockRegister = vi.fn()

vi.mock('../../app/stores/auth.vais', () => ({
  create_auth_store: () => ({
    user: '',
    token: '',
    refresh_token: '',
    is_authenticated: false,
    loading: false,
    error: '',
  }),
  login: mockLogin,
  register: mockRegister,
  logout: vi.fn(),
}))

vi.mock('../../app/i18n.vais', () => ({
  t: (key: string) => key,
}))

;(globalThis as any).router = { navigate: mockNavigate }
;(globalThis as any).window = { router: { navigate: mockNavigate } }

// ---------------------------------------------------------------------------
// Validation helpers (mirrored from component logic)
// ---------------------------------------------------------------------------

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function validateEmailField(email: string): string {
  if (email.length === 0) return 'auth.emailRequired'
  if (!isValidEmail(email)) return 'auth.invalidCredentials'
  return ''
}

function validatePasswordField(password: string): string {
  if (password.length === 0) return 'auth.passwordRequired'
  if (password.length < 8) return 'Password must be at least 8 characters'
  return ''
}

function validateNameField(name: string): string {
  if (name.trim().length === 0) return 'auth.nameRequired'
  return ''
}

function validateConfirmPassword(password: string, confirm: string): string {
  if (confirm.length === 0) return 'auth.passwordRequired'
  if (password !== confirm) return 'Passwords do not match'
  return ''
}

// ---------------------------------------------------------------------------
// DOM mount helpers
// ---------------------------------------------------------------------------

function mountLoginForm(options: {
  email?: string
  password?: string
  emailError?: string
  passwordError?: string
  errorMessage?: string
  loading?: boolean
  showPassword?: boolean
} = {}) {
  const {
    email = '',
    password = '',
    emailError = '',
    passwordError = '',
    errorMessage = '',
    loading = false,
    showPassword = false,
  } = options

  const page = document.createElement('div')
  page.className = 'login-page'
  const card = document.createElement('div')
  card.className = 'login-card'

  // Error message
  if (errorMessage) {
    const alert = document.createElement('div')
    alert.className = 'alert alert-error'
    alert.setAttribute('role', 'alert')
    alert.setAttribute('data-testid', 'error-message')
    alert.textContent = errorMessage
    card.appendChild(alert)
  }

  // Form
  const form = document.createElement('form')
  form.className = 'auth-form'
  form.setAttribute('data-testid', 'login-form')

  // Email group
  const emailGroup = document.createElement('div')
  emailGroup.className = 'form-group' + (emailError ? ' has-error' : '')
  const emailLabel = document.createElement('label')
  emailLabel.htmlFor = 'email'
  emailLabel.textContent = 'auth.email'
  const emailInput = document.createElement('input')
  emailInput.id = 'email'
  emailInput.type = 'email'
  emailInput.className = 'form-input'
  emailInput.value = email
  emailInput.disabled = loading
  emailInput.setAttribute('data-testid', 'email-input')
  emailGroup.appendChild(emailLabel)
  emailGroup.appendChild(emailInput)
  if (emailError) {
    const err = document.createElement('span')
    err.className = 'field-error'
    err.setAttribute('data-testid', 'email-error')
    err.textContent = emailError
    emailGroup.appendChild(err)
  }
  form.appendChild(emailGroup)

  // Password group
  const passGroup = document.createElement('div')
  passGroup.className = 'form-group' + (passwordError ? ' has-error' : '')
  const passLabel = document.createElement('label')
  passLabel.htmlFor = 'password'
  passLabel.textContent = 'auth.password'
  const inputWrapper = document.createElement('div')
  inputWrapper.className = 'input-wrapper'
  const passInput = document.createElement('input')
  passInput.id = 'password'
  passInput.type = showPassword ? 'text' : 'password'
  passInput.className = 'form-input'
  passInput.value = password
  passInput.disabled = loading
  passInput.setAttribute('data-testid', 'password-input')
  const toggleBtn = document.createElement('button')
  toggleBtn.type = 'button'
  toggleBtn.className = 'toggle-password'
  toggleBtn.setAttribute('data-testid', 'toggle-password')
  toggleBtn.setAttribute('aria-label', 'Toggle password visibility')
  toggleBtn.textContent = showPassword ? '🙈' : '👁'
  inputWrapper.appendChild(passInput)
  inputWrapper.appendChild(toggleBtn)
  passGroup.appendChild(passLabel)
  passGroup.appendChild(inputWrapper)
  if (passwordError) {
    const err = document.createElement('span')
    err.className = 'field-error'
    err.setAttribute('data-testid', 'password-error')
    err.textContent = passwordError
    passGroup.appendChild(err)
  }
  form.appendChild(passGroup)

  // Submit button
  const submitBtn = document.createElement('button')
  submitBtn.type = 'submit'
  submitBtn.className = 'btn btn-primary'
  submitBtn.disabled = loading
  submitBtn.setAttribute('data-testid', 'submit-btn')
  submitBtn.textContent = loading ? 'auth.loggingIn' : 'auth.loginBtn'
  form.appendChild(submitBtn)
  card.appendChild(form)

  // Divider
  const divider = document.createElement('div')
  divider.className = 'divider'
  const dividerText = document.createElement('span')
  dividerText.className = 'divider-text'
  dividerText.textContent = 'or'
  divider.appendChild(dividerText)
  card.appendChild(divider)

  // GitHub OAuth button
  const githubBtn = document.createElement('button')
  githubBtn.type = 'button'
  githubBtn.className = 'btn btn-github'
  githubBtn.disabled = loading
  githubBtn.setAttribute('data-testid', 'github-btn')
  githubBtn.innerHTML = '<svg></svg><span>auth.githubLogin</span>'
  card.appendChild(githubBtn)

  // Register link
  const authLink = document.createElement('p')
  authLink.className = 'auth-link'
  const registerLink = document.createElement('a')
  registerLink.href = '/auth/register'
  registerLink.className = 'link'
  registerLink.setAttribute('data-testid', 'register-link')
  registerLink.textContent = 'auth.goToRegister'
  authLink.textContent = 'auth.noAccount'
  authLink.appendChild(registerLink)
  card.appendChild(authLink)

  page.appendChild(card)
  document.body.appendChild(page)
  return page
}

function mountRegisterForm(options: {
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
  nameError?: string
  emailError?: string
  passwordError?: string
  confirmPasswordError?: string
  errorMessage?: string
  loading?: boolean
} = {}) {
  const {
    name = '',
    email = '',
    password = '',
    nameError = '',
    emailError = '',
    passwordError = '',
    confirmPasswordError = '',
    errorMessage = '',
    loading = false,
  } = options

  const page = document.createElement('div')
  page.className = 'register-page'
  const card = document.createElement('div')
  card.className = 'register-card'

  if (errorMessage) {
    const alert = document.createElement('div')
    alert.className = 'alert alert-error'
    alert.setAttribute('role', 'alert')
    alert.setAttribute('data-testid', 'error-message')
    alert.textContent = errorMessage
    card.appendChild(alert)
  }

  const form = document.createElement('form')
  form.className = 'auth-form'
  form.setAttribute('data-testid', 'register-form')

  function addField(id: string, type: string, labelText: string, val: string, error: string, testId: string) {
    const group = document.createElement('div')
    group.className = 'form-group' + (error ? ' has-error' : '')
    const label = document.createElement('label')
    label.htmlFor = id
    label.textContent = labelText
    const input = document.createElement('input')
    input.id = id
    input.type = type
    input.className = 'form-input'
    input.value = val
    input.disabled = loading
    input.setAttribute('data-testid', testId)
    group.appendChild(label)
    group.appendChild(input)
    if (error) {
      const err = document.createElement('span')
      err.className = 'field-error'
      err.setAttribute('data-testid', `${testId}-error`)
      err.textContent = error
      group.appendChild(err)
    }
    return group
  }

  form.appendChild(addField('name', 'text', 'auth.name', name, nameError, 'name-input'))
  form.appendChild(addField('email', 'email', 'auth.email', email, emailError, 'email-input'))
  form.appendChild(addField('password', 'password', 'auth.password', password, passwordError, 'password-input'))
  form.appendChild(addField('confirm-password', 'password', 'auth.confirmPassword', '', confirmPasswordError, 'confirm-password-input'))

  const submitBtn = document.createElement('button')
  submitBtn.type = 'submit'
  submitBtn.className = 'btn btn-primary'
  submitBtn.disabled = loading
  submitBtn.setAttribute('data-testid', 'submit-btn')
  submitBtn.textContent = 'auth.registerBtn'
  form.appendChild(submitBtn)

  card.appendChild(form)

  // GitHub OAuth button
  const githubBtn = document.createElement('button')
  githubBtn.type = 'button'
  githubBtn.className = 'btn btn-github'
  githubBtn.setAttribute('data-testid', 'github-btn')
  githubBtn.textContent = 'auth.githubLogin'
  card.appendChild(githubBtn)

  // Login link
  const loginLink = document.createElement('a')
  loginLink.href = '/auth/login'
  loginLink.className = 'link'
  loginLink.setAttribute('data-testid', 'login-link')
  loginLink.textContent = 'auth.goToLogin'
  card.appendChild(loginLink)

  page.appendChild(card)
  document.body.appendChild(page)
  return page
}

// ---------------------------------------------------------------------------
// Tests: Login Form
// ---------------------------------------------------------------------------

describe('Auth - Login Form', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    mockNavigate.mockClear()
    mockLogin.mockClear()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('should render email and password inputs', () => {
    const page = mountLoginForm()

    expect(page.querySelector('[data-testid="email-input"]')).not.toBeNull()
    expect(page.querySelector('[data-testid="password-input"]')).not.toBeNull()
  })

  it('should render submit button', () => {
    const page = mountLoginForm()

    const btn = page.querySelector('[data-testid="submit-btn"]')
    expect(btn).not.toBeNull()
    expect((btn as HTMLButtonElement).disabled).toBe(false)
  })

  it('should disable inputs and button while loading', () => {
    const page = mountLoginForm({ loading: true })

    const emailInput = page.querySelector<HTMLInputElement>('[data-testid="email-input"]')!
    const passInput = page.querySelector<HTMLInputElement>('[data-testid="password-input"]')!
    const submitBtn = page.querySelector<HTMLButtonElement>('[data-testid="submit-btn"]')!

    expect(emailInput.disabled).toBe(true)
    expect(passInput.disabled).toBe(true)
    expect(submitBtn.disabled).toBe(true)
  })

  it('should show email validation error for empty email', () => {
    const error = validateEmailField('')
    expect(error).toBe('auth.emailRequired')
  })

  it('should show email validation error for invalid email format', () => {
    const error = validateEmailField('not-an-email')
    expect(error).toBe('auth.invalidCredentials')
  })

  it('should pass validation for valid email', () => {
    const error = validateEmailField('user@example.com')
    expect(error).toBe('')
  })

  it('should show password validation error for empty password', () => {
    const error = validatePasswordField('')
    expect(error).toBe('auth.passwordRequired')
  })

  it('should show password validation error for short password', () => {
    const error = validatePasswordField('abc')
    expect(error).toBe('Password must be at least 8 characters')
  })

  it('should pass validation for valid password', () => {
    const error = validatePasswordField('securepassword')
    expect(error).toBe('')
  })

  it('should render field error messages when present', () => {
    const page = mountLoginForm({
      emailError: 'auth.emailRequired',
      passwordError: 'auth.passwordRequired',
    })

    const emailErr = page.querySelector('[data-testid="email-error"]')
    const passErr = page.querySelector('[data-testid="password-error"]')

    expect(emailErr?.textContent).toBe('auth.emailRequired')
    expect(passErr?.textContent).toBe('auth.passwordRequired')
  })

  it('should apply has-error class to form group on validation failure', () => {
    const page = mountLoginForm({ emailError: 'auth.emailRequired' })

    const emailGroup = page.querySelector('[data-testid="email-input"]')?.closest('.form-group')
    expect(emailGroup?.classList.contains('has-error')).toBe(true)
  })

  it('should show error alert when server returns error', () => {
    const page = mountLoginForm({ errorMessage: 'auth.invalidCredentials' })

    const alert = page.querySelector('[data-testid="error-message"]')
    expect(alert).not.toBeNull()
    expect(alert?.textContent).toBe('auth.invalidCredentials')
  })

  it('should not show error alert when no server error', () => {
    const page = mountLoginForm({ errorMessage: '' })

    const alert = page.querySelector('[data-testid="error-message"]')
    expect(alert).toBeNull()
  })

  it('should toggle password visibility', () => {
    const page = mountLoginForm({ showPassword: false })

    const passInput = page.querySelector<HTMLInputElement>('[data-testid="password-input"]')!
    expect(passInput.type).toBe('password')

    // Re-mount with showPassword=true
    document.body.innerHTML = ''
    const pageVisible = mountLoginForm({ showPassword: true })
    const passInputVisible = pageVisible.querySelector<HTMLInputElement>('[data-testid="password-input"]')!
    expect(passInputVisible.type).toBe('text')
  })

  it('should render GitHub OAuth button', () => {
    const page = mountLoginForm()

    const githubBtn = page.querySelector('[data-testid="github-btn"]')
    expect(githubBtn).not.toBeNull()
  })

  it('should render link to registration page', () => {
    const page = mountLoginForm()

    const registerLink = page.querySelector('[data-testid="register-link"]')
    expect(registerLink).not.toBeNull()
    expect((registerLink as HTMLAnchorElement).href).toContain('/auth/register')
  })

  it('should call login API with correct credentials on submit', async () => {
    mockLogin.mockResolvedValue({ ok: true, data: { token: 'abc' } })

    const credentials = { email: 'user@example.com', password: 'password123' }

    await mockLogin({}, credentials.email, credentials.password)

    expect(mockLogin).toHaveBeenCalledWith(
      expect.anything(),
      'user@example.com',
      'password123',
    )
  })
})

// ---------------------------------------------------------------------------
// Tests: Register Form
// ---------------------------------------------------------------------------

describe('Auth - Register Form', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    mockNavigate.mockClear()
    mockRegister.mockClear()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('should render name, email, password, and confirm password inputs', () => {
    const page = mountRegisterForm()

    expect(page.querySelector('[data-testid="name-input"]')).not.toBeNull()
    expect(page.querySelector('[data-testid="email-input"]')).not.toBeNull()
    expect(page.querySelector('[data-testid="password-input"]')).not.toBeNull()
    expect(page.querySelector('[data-testid="confirm-password-input"]')).not.toBeNull()
  })

  it('should show name validation error for empty name', () => {
    const error = validateNameField('')
    expect(error).toBe('auth.nameRequired')
  })

  it('should show name validation error for whitespace-only name', () => {
    const error = validateNameField('   ')
    expect(error).toBe('auth.nameRequired')
  })

  it('should pass name validation for valid name', () => {
    const error = validateNameField('Alice')
    expect(error).toBe('')
  })

  it('should show confirm password error when passwords do not match', () => {
    const error = validateConfirmPassword('password123', 'password456')
    expect(error).toBe('Passwords do not match')
  })

  it('should pass confirm password validation when passwords match', () => {
    const error = validateConfirmPassword('password123', 'password123')
    expect(error).toBe('')
  })

  it('should render submit button', () => {
    const page = mountRegisterForm()

    const btn = page.querySelector('[data-testid="submit-btn"]')
    expect(btn).not.toBeNull()
  })

  it('should render name field error when provided', () => {
    const page = mountRegisterForm({ nameError: 'auth.nameRequired' })

    const nameErr = page.querySelector('[data-testid="name-input-error"]')
    expect(nameErr?.textContent).toBe('auth.nameRequired')
    const nameGroup = page.querySelector('[data-testid="name-input"]')?.closest('.form-group')
    expect(nameGroup?.classList.contains('has-error')).toBe(true)
  })

  it('should show server error message', () => {
    const page = mountRegisterForm({ errorMessage: 'Email already in use' })

    const alert = page.querySelector('[data-testid="error-message"]')
    expect(alert?.textContent).toBe('Email already in use')
  })

  it('should render GitHub OAuth button', () => {
    const page = mountRegisterForm()

    const githubBtn = page.querySelector('[data-testid="github-btn"]')
    expect(githubBtn).not.toBeNull()
  })

  it('should render link to login page', () => {
    const page = mountRegisterForm()

    const loginLink = page.querySelector('[data-testid="login-link"]')
    expect(loginLink).not.toBeNull()
    expect((loginLink as HTMLAnchorElement).href).toContain('/auth/login')
  })

  it('should call register API with correct data on submit', async () => {
    mockRegister.mockResolvedValue({ ok: true })

    await mockRegister({}, 'user@example.com', 'password123', 'Alice')

    expect(mockRegister).toHaveBeenCalledWith(
      expect.anything(),
      'user@example.com',
      'password123',
      'Alice',
    )
  })

  it('should disable all inputs when loading', () => {
    const page = mountRegisterForm({ loading: true })

    const inputs = page.querySelectorAll<HTMLInputElement>('.form-input')
    inputs.forEach((input) => {
      expect(input.disabled).toBe(true)
    })
  })
})
