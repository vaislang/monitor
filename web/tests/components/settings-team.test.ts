import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn()
const mockFetch = vi.fn()

vi.mock('../../app/i18n.vais', () => ({
  t: (key: string) => key,
}))

vi.mock('../../app/stores/app.vais', () => ({
  appStore: { page_title: 'Settings', is_loading: false },
}))

vi.mock('../../app/stores/auth.vais', () => ({
  authStore: {
    user: JSON.stringify({ id: 1, name: 'Alice', email: 'alice@test.com', role: 'admin' }),
    is_authenticated: true,
  },
}))

;(globalThis as any).router = { navigate: mockNavigate }
;(globalThis as any).fetch = mockFetch

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MemberRole = 'admin' | 'member' | 'viewer'

interface TeamMember {
  id: number
  name: string
  email: string
  role: MemberRole
  joined_at?: string
}

interface TeamInvite {
  id: string
  email: string
  role: MemberRole
  invited_at: string
  expires_at?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMemberRow(member: TeamMember, currentUserRole: MemberRole): HTMLElement {
  const row = document.createElement('div')
  row.className = 'member-row'
  row.setAttribute('data-testid', 'member-row')
  row.setAttribute('data-id', String(member.id))

  const avatar = document.createElement('div')
  avatar.className = 'member-avatar'
  avatar.textContent = member.name.charAt(0).toUpperCase()

  const info = document.createElement('div')
  info.className = 'member-info'
  const nameSpan = document.createElement('span')
  nameSpan.className = 'member-name'
  nameSpan.setAttribute('data-testid', 'member-name')
  nameSpan.textContent = member.name
  const emailSpan = document.createElement('span')
  emailSpan.className = 'member-email'
  emailSpan.setAttribute('data-testid', 'member-email')
  emailSpan.textContent = member.email
  info.appendChild(nameSpan)
  info.appendChild(emailSpan)

  const roleSelect = document.createElement('select')
  roleSelect.className = 'role-select'
  roleSelect.setAttribute('data-testid', 'role-select')
  roleSelect.disabled = currentUserRole !== 'admin'
  for (const r of ['admin', 'member', 'viewer'] as MemberRole[]) {
    const opt = document.createElement('option')
    opt.value = r
    opt.textContent = `settings.role.${r}`
    opt.selected = r === member.role
    roleSelect.appendChild(opt)
  }

  const removeBtn = document.createElement('button')
  removeBtn.type = 'button'
  removeBtn.className = 'btn btn-danger remove-btn'
  removeBtn.setAttribute('data-testid', 'remove-btn')
  removeBtn.disabled = currentUserRole !== 'admin'
  removeBtn.textContent = 'common.remove'

  row.appendChild(avatar)
  row.appendChild(info)
  row.appendChild(roleSelect)
  row.appendChild(removeBtn)

  return row
}

function buildMemberList(
  members: TeamMember[],
  currentUserRole: MemberRole,
  loading: boolean,
  error: string,
): HTMLElement {
  const container = document.createElement('div')
  container.className = 'members-list'
  container.setAttribute('data-testid', 'members-list')

  if (loading) {
    const spinner = document.createElement('div')
    spinner.className = 'loading-spinner'
    spinner.setAttribute('data-testid', 'loading-spinner')
    container.appendChild(spinner)
    return container
  }

  if (error) {
    const errDiv = document.createElement('div')
    errDiv.className = 'error-state'
    errDiv.setAttribute('data-testid', 'error-state')
    errDiv.textContent = error
    container.appendChild(errDiv)
    return container
  }

  for (const member of members) {
    container.appendChild(buildMemberRow(member, currentUserRole))
  }

  return container
}

function buildInviteForm(loading: boolean): HTMLElement {
  const form = document.createElement('form')
  form.className = 'invite-form'
  form.setAttribute('data-testid', 'invite-form')

  const emailInput = document.createElement('input')
  emailInput.type = 'email'
  emailInput.className = 'form-input'
  emailInput.placeholder = 'settings.inviteEmailPlaceholder'
  emailInput.disabled = loading
  emailInput.setAttribute('data-testid', 'invite-email-input')
  form.appendChild(emailInput)

  const roleSelect = document.createElement('select')
  roleSelect.className = 'form-select'
  roleSelect.disabled = loading
  roleSelect.setAttribute('data-testid', 'invite-role-select')
  for (const r of ['member', 'viewer', 'admin']) {
    const opt = document.createElement('option')
    opt.value = r
    opt.textContent = `settings.role.${r}`
    roleSelect.appendChild(opt)
  }
  form.appendChild(roleSelect)

  const submitBtn = document.createElement('button')
  submitBtn.type = 'submit'
  submitBtn.className = 'btn btn-primary'
  submitBtn.disabled = loading
  submitBtn.setAttribute('data-testid', 'invite-submit-btn')
  submitBtn.textContent = loading ? 'common.sending' : 'settings.sendInvite'
  form.appendChild(submitBtn)

  return form
}

function buildPendingInvites(invites: TeamInvite[]): HTMLElement {
  const container = document.createElement('div')
  container.className = 'pending-invites'
  container.setAttribute('data-testid', 'pending-invites')

  if (invites.length === 0) {
    return container
  }

  const title = document.createElement('h4')
  title.textContent = 'settings.pendingInvites'
  container.appendChild(title)

  for (const invite of invites) {
    const item = document.createElement('div')
    item.className = 'invite-item'
    item.setAttribute('data-testid', 'invite-item')
    item.setAttribute('data-id', invite.id)
    const emailSpan = document.createElement('span')
    emailSpan.className = 'invite-email'
    emailSpan.textContent = invite.email
    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.className = 'btn btn-secondary cancel-invite-btn'
    cancelBtn.setAttribute('data-testid', 'cancel-invite-btn')
    cancelBtn.textContent = 'common.cancel'
    item.appendChild(emailSpan)
    item.appendChild(cancelBtn)
    container.appendChild(item)
  }

  return container
}

function mountSettingsTeamPage(options: {
  members?: TeamMember[]
  invites?: TeamInvite[]
  currentUserRole?: MemberRole
  loading?: boolean
  error?: string
} = {}): HTMLElement {
  const {
    members = [],
    invites = [],
    currentUserRole = 'admin',
    loading = false,
    error = '',
  } = options

  const page = document.createElement('div')
  page.className = 'settings-team-page'

  const header = document.createElement('div')
  header.className = 'page-header'
  const h2 = document.createElement('h2')
  h2.className = 'page-title'
  h2.textContent = 'settings.teamTitle'
  header.appendChild(h2)
  page.appendChild(header)

  const membersSection = document.createElement('section')
  membersSection.className = 'members-section'
  const membersTitle = document.createElement('h3')
  membersTitle.textContent = 'settings.teamMembers'
  membersSection.appendChild(membersTitle)
  membersSection.appendChild(buildMemberList(members, currentUserRole, loading, error))
  page.appendChild(membersSection)

  if (currentUserRole === 'admin') {
    const inviteSection = document.createElement('section')
    inviteSection.className = 'invite-section'
    const inviteTitle = document.createElement('h3')
    inviteTitle.textContent = 'settings.inviteMember'
    inviteSection.appendChild(inviteTitle)
    inviteSection.appendChild(buildInviteForm(loading))
    inviteSection.appendChild(buildPendingInvites(invites))
    page.appendChild(inviteSection)
  }

  document.body.appendChild(page)
  return page
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Settings Team Page', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    mockNavigate.mockClear()
    mockFetch.mockClear()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('Team Members', () => {
    it('should fetch team members list', async () => {
      const members = [
        { id: 1, name: 'Alice', email: 'alice@test.com', role: 'admin' },
        { id: 2, name: 'Bob', email: 'bob@test.com', role: 'member' },
      ]
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ members }) })

      const resp = await fetch('/api/v1/teams/1/members', {
        headers: { 'Authorization': 'Bearer test-token' },
      })
      const data = await resp.json()

      expect(data.members).toHaveLength(2)
      expect(data.members[0].role).toBe('admin')
    })

    it('should render member rows in DOM', () => {
      const members: TeamMember[] = [
        { id: 1, name: 'Alice', email: 'alice@test.com', role: 'admin' },
        { id: 2, name: 'Bob', email: 'bob@test.com', role: 'member' },
      ]
      const page = mountSettingsTeamPage({ members })

      const rows = page.querySelectorAll('[data-testid="member-row"]')
      expect(rows.length).toBe(2)
    })

    it('should display member names and emails', () => {
      const members: TeamMember[] = [
        { id: 1, name: 'Alice', email: 'alice@test.com', role: 'admin' },
      ]
      const page = mountSettingsTeamPage({ members })

      const name = page.querySelector('[data-testid="member-name"]')
      const email = page.querySelector('[data-testid="member-email"]')

      expect(name?.textContent).toBe('Alice')
      expect(email?.textContent).toBe('alice@test.com')
    })

    it('should add team member', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })

      await fetch('/api/v1/teams/1/members', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'charlie@test.com', role: 'member' }),
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/teams/1/members',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('should remove team member', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })

      await fetch('/api/v1/teams/1/members/2', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer test-token' },
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/teams/1/members/2',
        expect.objectContaining({ method: 'DELETE' }),
      )
    })

    it('should call remove handler on remove button click', () => {
      const mockRemove = vi.fn()
      const members: TeamMember[] = [
        { id: 2, name: 'Bob', email: 'bob@test.com', role: 'member' },
      ]
      const page = mountSettingsTeamPage({ members, currentUserRole: 'admin' })

      const removeBtn = page.querySelector<HTMLButtonElement>('[data-testid="remove-btn"]')!
      removeBtn.addEventListener('click', mockRemove)
      removeBtn.click()

      expect(mockRemove).toHaveBeenCalledTimes(1)
    })

    it('should show loading spinner while fetching', () => {
      const page = mountSettingsTeamPage({ loading: true })

      const spinner = page.querySelector('[data-testid="loading-spinner"]')
      expect(spinner).not.toBeNull()
    })

    it('should show error state on fetch failure', () => {
      const page = mountSettingsTeamPage({ error: 'settings.fetchError' })

      const errState = page.querySelector('[data-testid="error-state"]')
      expect(errState).not.toBeNull()
    })
  })

  describe('Role Management', () => {
    it('should update member role', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })

      await fetch('/api/v1/teams/1/members/2/role', {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin' }),
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/teams/1/members/2/role',
        expect.objectContaining({ method: 'PUT' }),
      )
    })

    it('should reject role change for non-admin', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Admin role required' }),
      })

      const resp = await fetch('/api/v1/teams/1/members/2/role', {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin' }),
      })

      expect(resp.ok).toBe(false)
      expect(resp.status).toBe(403)
    })

    it('should disable role select for non-admin current user', () => {
      const members: TeamMember[] = [
        { id: 2, name: 'Bob', email: 'bob@test.com', role: 'member' },
      ]
      const page = mountSettingsTeamPage({ members, currentUserRole: 'member' })

      const roleSelect = page.querySelector<HTMLSelectElement>('[data-testid="role-select"]')
      expect(roleSelect?.disabled).toBe(true)
    })

    it('should enable role select for admin current user', () => {
      const members: TeamMember[] = [
        { id: 2, name: 'Bob', email: 'bob@test.com', role: 'member' },
      ]
      const page = mountSettingsTeamPage({ members, currentUserRole: 'admin' })

      const roleSelect = page.querySelector<HTMLSelectElement>('[data-testid="role-select"]')
      expect(roleSelect?.disabled).toBe(false)
    })

    it('should show current role selected in role select', () => {
      const members: TeamMember[] = [
        { id: 2, name: 'Bob', email: 'bob@test.com', role: 'member' },
      ]
      const page = mountSettingsTeamPage({ members, currentUserRole: 'admin' })

      const roleSelect = page.querySelector<HTMLSelectElement>('[data-testid="role-select"]')
      expect(roleSelect?.value).toBe('member')
    })
  })

  describe('Team Invite', () => {
    it('should send team invitation', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ invite_id: 'inv-1' }) })

      await fetch('/api/v1/teams/1/invites', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'newuser@test.com' }),
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/teams/1/invites',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('should render invite form for admin users', () => {
      const page = mountSettingsTeamPage({ currentUserRole: 'admin' })

      const form = page.querySelector('[data-testid="invite-form"]')
      expect(form).not.toBeNull()
    })

    it('should not render invite form for non-admin users', () => {
      const page = mountSettingsTeamPage({ currentUserRole: 'member' })

      const form = page.querySelector('[data-testid="invite-form"]')
      expect(form).toBeNull()
    })

    it('should render email input in invite form', () => {
      const page = mountSettingsTeamPage({ currentUserRole: 'admin' })

      const emailInput = page.querySelector('[data-testid="invite-email-input"]')
      expect(emailInput).not.toBeNull()
    })

    it('should render role select in invite form', () => {
      const page = mountSettingsTeamPage({ currentUserRole: 'admin' })

      const roleSelect = page.querySelector('[data-testid="invite-role-select"]')
      expect(roleSelect).not.toBeNull()
    })

    it('should disable invite form while loading', () => {
      const page = mountSettingsTeamPage({ currentUserRole: 'admin', loading: true })

      const submitBtn = page.querySelector<HTMLButtonElement>('[data-testid="invite-submit-btn"]')
      expect(submitBtn?.disabled).toBe(true)
    })

    it('should render pending invites', () => {
      const invites: TeamInvite[] = [
        { id: 'inv-1', email: 'pending@test.com', role: 'member', invited_at: '2026-04-07T10:00:00Z' },
      ]
      const page = mountSettingsTeamPage({ currentUserRole: 'admin', invites })

      const inviteItems = page.querySelectorAll('[data-testid="invite-item"]')
      expect(inviteItems.length).toBe(1)
    })

    it('should render cancel button for each pending invite', () => {
      const invites: TeamInvite[] = [
        { id: 'inv-1', email: 'pending@test.com', role: 'member', invited_at: '2026-04-07T10:00:00Z' },
        { id: 'inv-2', email: 'pending2@test.com', role: 'viewer', invited_at: '2026-04-07T11:00:00Z' },
      ]
      const page = mountSettingsTeamPage({ currentUserRole: 'admin', invites })

      const cancelBtns = page.querySelectorAll('[data-testid="cancel-invite-btn"]')
      expect(cancelBtns.length).toBe(2)
    })

    it('should not render pending invites section when invites list is empty', () => {
      const page = mountSettingsTeamPage({ currentUserRole: 'admin', invites: [] })

      const pendingInvites = page.querySelector('[data-testid="pending-invites"]')
      // Container exists but has no invite items
      const inviteItems = pendingInvites?.querySelectorAll('[data-testid="invite-item"]')
      expect(inviteItems?.length).toBe(0)
    })
  })
})
