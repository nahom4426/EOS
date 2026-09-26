<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ t('members.title') }}</h1>
        <p class="page-subtitle">
          <span v-if="viewMode === 'grouped'">
            {{ groupedData.total_first_children || 0 }} First Children • {{ groupedData.total_members || 0 }} Members
          </span>
          <span v-else>
            {{ pagination.total }} {{ t('common.total').toLowerCase() }}
          </span>
        </p>
      </div>
      <div class="flex gap-2 align-center">
        <!-- View mode toggle -->
        <div class="view-toggle">
          <button
            class="btn btn-sm"
            :class="viewMode === 'grouped' ? 'btn-primary' : 'btn-ghost'"
            @click="switchViewMode('grouped')"
          >
            👨‍👩‍👧‍👦 Family Hierarchy
          </button>
          <button
            class="btn btn-sm"
            :class="viewMode === 'flat' ? 'btn-primary' : 'btn-ghost'"
            @click="switchViewMode('flat')"
          >
            📋 Flat List
          </button>
        </div>

        <button class="btn btn-primary" @click="openModal()">
          ＋ Add Member / User
        </button>
      </div>
    </div>

    <div class="page-content">
      <!-- Filters toolbar -->
      <div class="toolbar mb-3" style="flex-wrap:wrap;gap:0.75rem;">
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input
            v-model="search"
            type="text"
            :placeholder="t('common.search')"
            @input="debouncedFetch"
          />
        </div>
        <select v-model="statusFilter" class="form-control" style="width:auto;" @change="handleFilterChange">
          <option value="active">Active Accounts</option>
          <option value="deactivated">Deactivated Accounts</option>
          <option value="all">All Accounts</option>
        </select>
        <select v-if="viewMode === 'flat'" v-model="paidFilter" class="form-control" style="width:auto;" @change="handleFilterChange">
          <option value="">{{ t('members.filterAll') }}</option>
          <option value="true">{{ t('members.filterPaid') }}</option>
          <option value="false">{{ t('members.filterUnpaid') }}</option>
        </select>
        <button class="btn btn-ghost btn-sm" @click="expandAllGroups" v-if="viewMode === 'grouped'">
          {{ allGroupsExpanded ? 'Collapse All' : 'Expand All' }}
        </button>
      </div>

      <!-- ========================================================================= -->
      <!-- GROUPED BY FIRST CHILD VIEW (DEFAULT HIERARCHY)                           -->
      <!-- ========================================================================= -->
      <div v-if="viewMode === 'grouped'">
        <div v-if="loading" class="loading-overlay" style="padding:3rem;"><div class="spinner"></div></div>
        
        <div v-else-if="fetchError" class="card empty-state" style="border:1px dashed var(--danger, #e53e3e);padding:2rem;">
          <div class="empty-icon">⚠️</div>
          <div class="empty-text" style="color:var(--danger, #e53e3e);font-weight:600;">Failed to load family data</div>
          <p class="text-muted" style="font-size:0.85rem;margin-top:0.3rem;">{{ fetchError }}</p>
          <button class="btn btn-primary btn-sm mt-2" @click="fetchGroupedMembers">🔄 Retry Loading</button>
        </div>

        <div v-else-if="!groupedData.groups.length && !groupedData.unassigned.length" class="card empty-state">
          <div class="empty-icon">👥</div>
          <div class="empty-text">No family records or members found</div>
        </div>

        <div v-else class="family-groups-container">
          <!-- First Child Family Cards -->
          <div
            v-for="group in filteredGroups"
            :key="group.first_child.id"
            class="card family-card mb-3"
            :class="{ 'is-expanded': isExpanded(group.first_child.id) }"
          >
            <!-- First Child Header Row -->
            <div class="family-card-header" @click="toggleGroup(group.first_child.id)">
              <div class="fc-info-col">
                <div class="avatar-with-badge">
                  <img
                    v-if="group.first_child.avatar_url"
                    :src="getAvatarUrl(group.first_child.avatar_url)"
                    class="fc-avatar-img"
                  />
                  <div v-else class="fc-avatar-placeholder">
                    {{ group.first_child.full_name.charAt(0) }}
                  </div>
                  <span class="role-mini-pill" title="First Child Role">👨‍👩‍👧‍👦</span>
                </div>

                <div>
                  <div class="fc-name-row">
                    <span class="fc-name">{{ group.first_child.full_name }}</span>
                    <span class="badge badge-gold font-bold">First Child</span>
                    <span v-if="group.first_child.mini_admin_name" class="badge badge-info text-xs">
                      📦 Mini-Admin: {{ group.first_child.mini_admin_name }}
                    </span>
                  </div>
                  <div class="fc-subtext">
                    📞 {{ group.first_child.phone }} • Joined {{ formatDate(group.first_child.created_at) }}
                  </div>
                </div>
              </div>

              <!-- Right Actions & Count Badge -->
              <div class="fc-actions-col" @click.stop>
                <span class="member-count-badge">
                  <span class="count-num">{{ group.member_count }}</span>
                  <span class="count-label">{{ group.member_count === 1 ? 'Member' : 'Members' }}</span>
                </span>

                <button
                  class="btn btn-ghost btn-sm"
                  @click="openModal(null, 'member', group.first_child.id)"
                  title="Add sibling directly under this First Child"
                >
                  ＋ Add Member
                </button>

                <button
                  class="btn btn-ghost btn-sm btn-icon expand-toggle-btn"
                  @click="toggleGroup(group.first_child.id)"
                >
                  {{ isExpanded(group.first_child.id) ? '▲' : '▼' }}
                </button>
              </div>
            </div>

            <!-- Expandable Nested Members Table -->
            <div v-if="isExpanded(group.first_child.id)" class="family-card-body">
              <div v-if="!group.members.length" class="empty-sub-state">
                <span class="text-muted">No family members registered under {{ group.first_child.full_name }} yet.</span>
                <button
                  class="btn btn-primary btn-xs ml-2"
                  @click="openModal(null, 'member', group.first_child.id)"
                >
                  ＋ Add First Member
                </button>
              </div>

              <div v-else class="table-wrapper" style="border:none;border-radius:0;">
                <table class="table inner-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Member Name</th>
                      <th>Phone</th>
                      <th>Consistency Score</th>
                      <th>Payment Status</th>
                      <th>Account Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(m, idx) in group.members"
                      :key="m.id"
                      :class="{ 'deactivated-row': !m.is_active }"
                    >
                      <td class="text-muted" style="font-size:0.8rem;">{{ idx + 1 }}</td>
                      <td>
                        <div class="flex items-center gap-2">
                          <img
                            v-if="m.avatar_url"
                            :src="getAvatarUrl(m.avatar_url)"
                            class="member-avatar-img"
                          />
                          <div v-else class="member-avatar">{{ m.full_name.charAt(0) }}</div>
                          <span style="font-weight:600;">{{ m.full_name }}</span>
                        </div>
                      </td>
                      <td class="text-muted">{{ m.phone }}</td>
                      <td>
                        <div class="score-badge-cell">
                          <span class="tier-icon" :title="m.tier">{{ m.tierBadge || '🥈' }}</span>
                          <span class="score-val" :style="{ color: m.tierColor || '#718096' }">
                            {{ m.score || 50 }}/100
                          </span>
                          <span v-if="m.streakMonths > 0" class="streak-mini">🔥{{ m.streakMonths }}m</span>
                        </div>
                      </td>
                      <td>
                        <span class="badge" :class="m.paid_this_month ? 'badge-success' : 'badge-danger'">
                          {{ m.paid_this_month ? t('members.paidThisMonth') : t('members.unpaidThisMonth') }}
                        </span>
                      </td>
                      <td>
                        <span class="badge" :class="m.is_active ? 'badge-success' : 'badge-danger'">
                          {{ m.is_active ? 'Active' : 'Deactivated' }}
                        </span>
                      </td>
                      <td>
                        <div class="flex gap-1">
                          <button class="btn btn-ghost btn-sm" @click="openStatement(m)">📜 Statement</button>
                          <template v-if="m.is_active">
                            <button class="btn btn-ghost btn-sm btn-icon" @click="openModal(m)">✏️</button>
                            <button class="btn btn-danger btn-sm" @click="confirmDeactivate(m)">🚫 Deactivate</button>
                          </template>
                          <template v-else>
                            <button class="btn btn-success btn-sm" @click="activateMember(m)">⚡ Activate</button>
                            <button v-if="auth.isSuperAdmin" class="btn btn-danger btn-sm" @click="confirmPermanentDelete(m)">🗑️</button>
                          </template>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Unassigned Members Card -->
          <div
            v-if="groupedData.unassigned.length"
            class="card family-card mb-3 unassigned-card"
            :class="{ 'is-expanded': isExpanded('unassigned') }"
          >
            <div class="family-card-header" @click="toggleGroup('unassigned')">
              <div class="fc-info-col">
                <div class="avatar-with-badge">
                  <div class="fc-avatar-placeholder" style="background:rgba(237,137,54,0.15);color:#dd6b20;">
                    ❓
                  </div>
                </div>
                <div>
                  <div class="fc-name-row">
                    <span class="fc-name">Unassigned / Direct Members</span>
                    <span class="badge badge-warning font-bold">Unassigned</span>
                  </div>
                  <div class="fc-subtext">Members without an assigned First Child</div>
                </div>
              </div>

              <div class="fc-actions-col" @click.stop>
                <span class="member-count-badge unassigned-badge">
                  <span class="count-num">{{ groupedData.unassigned.length }}</span>
                  <span class="count-label">Members</span>
                </span>
                <button
                  class="btn btn-ghost btn-sm btn-icon expand-toggle-btn"
                  @click="toggleGroup('unassigned')"
                >
                  {{ isExpanded('unassigned') ? '▲' : '▼' }}
                </button>
              </div>
            </div>

            <div v-if="isExpanded('unassigned')" class="family-card-body">
              <div class="table-wrapper" style="border:none;border-radius:0;">
                <table class="table inner-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Member Name</th>
                      <th>Phone</th>
                      <th>Consistency Score</th>
                      <th>Payment Status</th>
                      <th>Account Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(m, idx) in groupedData.unassigned"
                      :key="m.id"
                      :class="{ 'deactivated-row': !m.is_active }"
                    >
                      <td class="text-muted" style="font-size:0.8rem;">{{ idx + 1 }}</td>
                      <td>
                        <div class="flex items-center gap-2">
                          <img v-if="m.avatar_url" :src="getAvatarUrl(m.avatar_url)" class="member-avatar-img" />
                          <div v-else class="member-avatar">{{ m.full_name.charAt(0) }}</div>
                          <span style="font-weight:600;">{{ m.full_name }}</span>
                        </div>
                      </td>
                      <td class="text-muted">{{ m.phone }}</td>
                      <td>
                        <div class="score-badge-cell">
                          <span class="tier-icon">{{ m.tierBadge || '🥈' }}</span>
                          <span class="score-val" :style="{ color: m.tierColor || '#718096' }">{{ m.score || 50 }}/100</span>
                        </div>
                      </td>
                      <td>
                        <span class="badge" :class="m.paid_this_month ? 'badge-success' : 'badge-danger'">
                          {{ m.paid_this_month ? t('members.paidThisMonth') : t('members.unpaidThisMonth') }}
                        </span>
                      </td>
                      <td>
                        <span class="badge" :class="m.is_active ? 'badge-success' : 'badge-danger'">
                          {{ m.is_active ? 'Active' : 'Deactivated' }}
                        </span>
                      </td>
                      <td>
                        <div class="flex gap-1">
                          <button class="btn btn-ghost btn-sm" @click="openStatement(m)">📜 Statement</button>
                          <button class="btn btn-ghost btn-sm btn-icon" @click="openModal(m)">✏️</button>
                          <button class="btn btn-danger btn-sm" @click="confirmDeactivate(m)">🚫 Deactivate</button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- FLAT LIST VIEW (STANDALONE TABLE)                                         -->
      <!-- ========================================================================= -->
      <div v-else-if="viewMode === 'flat'">
        <div class="card">
          <div class="card-body" style="padding:0;">
            <div v-if="loading" class="loading-overlay"><div class="spinner"></div></div>
            <div v-else-if="!members.length" class="empty-state">
              <div class="empty-icon">👥</div>
              <div class="empty-text">{{ t('common.noData') }}</div>
            </div>
            <div v-else>
              <div class="table-wrapper" style="border:none;border-radius:0;">
                <table class="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{{ t('common.name') }}</th>
                      <th>{{ t('common.phone') }}</th>
                      <th>Consistency Score</th>
                      <th>Payment Status</th>
                      <th>Account Status</th>
                      <th>{{ t('members.joinedOn') }}</th>
                      <th>{{ t('common.actions') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(m, i) in members" :key="m.id" :class="{ 'deactivated-row': !m.is_active }">
                      <td class="text-muted" style="font-size:0.8rem;">{{ (pagination.page - 1) * pagination.limit + i + 1 }}</td>
                      <td>
                        <div style="display:flex;align-items:center;gap:0.75rem;">
                          <img v-if="m.avatar_url" :src="getAvatarUrl(m.avatar_url)" class="member-avatar-img" />
                          <div v-else class="member-avatar">{{ m.full_name.charAt(0) }}</div>
                          <span style="font-weight:600;">{{ m.full_name }}</span>
                        </div>
                      </td>
                      <td class="text-muted">{{ m.phone }}</td>
                      <td>
                        <div class="score-badge-cell">
                          <span class="tier-icon" :title="m.tier">{{ m.tierBadge || '🥈' }}</span>
                          <span class="score-val" :style="{ color: m.tierColor || '#718096' }">{{ m.score || 50 }}/100</span>
                          <span v-if="m.streakMonths > 0" class="streak-mini" title="Active streak">🔥{{ m.streakMonths }}m</span>
                        </div>
                      </td>
                      <td>
                        <span class="badge" :class="m.paid_this_month ? 'badge-success' : 'badge-danger'">
                          {{ m.paid_this_month ? t('members.paidThisMonth') : t('members.unpaidThisMonth') }}
                        </span>
                      </td>
                      <td>
                        <span class="badge" :class="m.is_active ? 'badge-success' : 'badge-danger'">
                          {{ m.is_active ? 'Active' : 'Deactivated' }}
                        </span>
                      </td>
                      <td class="text-muted" style="font-size:0.8rem;">{{ formatDate(m.created_at) }}</td>
                      <td>
                        <div class="flex gap-1" style="flex-wrap:nowrap;">
                          <button class="btn btn-ghost btn-sm" @click="openStatement(m)" title="Annual Statement">📜 Statement</button>

                          <template v-if="m.is_active">
                            <button class="btn btn-ghost btn-sm btn-icon" @click="openModal(m)" title="Edit">✏️</button>
                            <button class="btn btn-danger btn-sm" @click="confirmDeactivate(m)" title="Deactivate Member">🚫 Deactivate</button>
                          </template>

                          <template v-else>
                            <button class="btn btn-success btn-sm" @click="activateMember(m)" title="Reactivate Member">⚡ Activate</button>
                            <button v-if="auth.isSuperAdmin" class="btn btn-danger btn-sm" @click="confirmPermanentDelete(m)" title="Permanent Delete">🗑️ Delete</button>
                          </template>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Pagination -->
              <div class="card-footer flex justify-between items-center">
                <span class="text-muted" style="font-size:0.8rem;">
                  {{ t('common.page') }} {{ pagination.page }} {{ t('common.of') }} {{ pagination.pages }}
                  ({{ pagination.total }} {{ t('common.total').toLowerCase() }})
                </span>
                <div class="pagination">
                  <button class="pagination-btn" :disabled="pagination.page <= 1" @click="fetchMembers(pagination.page - 1)">‹</button>
                  <button
                    v-for="p in visiblePages" :key="p"
                    class="pagination-btn" :class="{ active: p === pagination.page }"
                    @click="fetchMembers(p)"
                  >{{ p }}</button>
                  <button class="pagination-btn" :disabled="pagination.page >= pagination.pages" @click="fetchMembers(pagination.page + 1)">›</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Annual Statement Modal -->
    <AnnualStatementModal
      :show="showStatementModal"
      :member="statementMember"
      :contributions="memberContributions"
      :year="statementYear"
      @close="showStatementModal = false"
      @year-change="handleYearChange"
    />

    <!-- Add/Edit modal with Role Selector & First Child assignment -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
        <div class="modal" style="max-width:500px;">
          <div class="modal-header">
            <span class="modal-title">
              {{ editing ? 'Edit User Account' : 'Add New User / Member' }}
            </span>
            <button class="btn btn-ghost btn-sm btn-icon" @click="showModal = false">✕</button>
          </div>
          <form @submit.prevent="saveMember">
            <div class="modal-body" style="display:flex;flex-direction:column;gap:1rem;">
              <div v-if="formError" class="alert alert-danger">{{ formError }}</div>
              
              <!-- Role / Account Type Selector -->
              <div class="form-group">
                <label class="form-label">Account Role / Type *</label>
                <div class="role-selector-grid">
                  <button
                    type="button"
                    class="role-select-card"
                    :class="{ active: form.role === 'member' }"
                    @click="form.role = 'member'"
                  >
                    <span class="r-icon">👤</span>
                    <span class="r-title">Member</span>
                    <span class="r-desc">End Contributor</span>
                  </button>

                  <button
                    v-if="['superadmin', 'admin', 'mini_admin'].includes(auth.user?.role)"
                    type="button"
                    class="role-select-card"
                    :class="{ active: form.role === 'first_child' }"
                    @click="form.role = 'first_child'"
                  >
                    <span class="r-icon">👨‍👩‍👧‍👦</span>
                    <span class="r-title">First Child</span>
                    <span class="r-desc">Family Leader</span>
                  </button>

                  <button
                    v-if="['superadmin', 'admin'].includes(auth.user?.role)"
                    type="button"
                    class="role-select-card"
                    :class="{ active: form.role === 'mini_admin' }"
                    @click="form.role = 'mini_admin'"
                  >
                    <span class="r-icon">📦</span>
                    <span class="r-title">Mini-Admin</span>
                    <span class="r-desc">Collector</span>
                  </button>

                  <button
                    v-if="auth.isSuperAdmin"
                    type="button"
                    class="role-select-card"
                    :class="{ active: form.role === 'admin' }"
                    @click="form.role = 'admin'"
                  >
                    <span class="r-icon">🏛️</span>
                    <span class="r-title">Admin</span>
                    <span class="r-desc">Branch Admin</span>
                  </button>
                </div>
              </div>

              <!-- First Child Assignment Dropdown (if role === 'member') -->
              <div v-if="form.role === 'member'" class="form-group">
                <label class="form-label">Assign to First Child (Family Rep) *</label>
                <select v-model="form.first_child_id" class="form-control" required>
                  <option :value="null" disabled>Select First Child...</option>
                  <option v-for="fc in firstChildOptions" :key="fc.id" :value="fc.id">
                    👨‍👩‍👧‍👦 {{ fc.full_name }} ({{ fc.phone }})
                  </option>
                </select>
                <div class="form-hint">Links this member to their family representative for monthly contribution logging.</div>
              </div>

              <!-- Mini-Admin Assignment Dropdown (if role === 'first_child') -->
              <div v-if="form.role === 'first_child'" class="form-group">
                <label class="form-label">Assign to Mini-Admin (Optional)</label>
                <select v-model="form.mini_admin_id" class="form-control">
                  <option :value="null">None (Direct Branch Handover)</option>
                  <option v-for="ma in miniAdminOptions" :key="ma.id" :value="ma.id">
                    📦 {{ ma.full_name }} ({{ ma.phone }})
                  </option>
                </select>
              </div>

              <!-- Avatar Upload Field -->
              <div class="form-group" style="text-align:center;margin-bottom:0.5rem;">
                <label class="form-label" style="display:block;margin-bottom:0.5rem;">Profile Picture (Optional)</label>
                <div style="display:inline-flex;flex-direction:column;align-items:center;gap:0.5rem;">
                  <div class="avatar-preview-container">
                    <img v-if="avatarPreview" :src="avatarPreview" class="avatar-preview-img" />
                    <div v-else class="avatar-preview-placeholder">
                      {{ form.full_name ? form.full_name.charAt(0) : '📷' }}
                    </div>
                  </div>
                  <div style="display:flex;gap:0.5rem;align-items:center;">
                    <label class="btn btn-ghost btn-sm" style="cursor:pointer;margin:0;">
                      📷 Choose Photo
                      <input type="file" accept="image/*" style="display:none;" @change="handleFileSelect" />
                    </label>
                    <button v-if="avatarPreview" type="button" class="btn btn-danger btn-sm" @click="removeAvatarFile">
                      ✕
                    </button>
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">{{ t('common.name') }} *</label>
                <input v-model="form.full_name" type="text" class="form-control" required placeholder="Full Name" />
              </div>
              <div class="form-group">
                <label class="form-label">{{ t('common.phone') }} *</label>
                <input v-model="form.phone" type="tel" class="form-control" required placeholder="09xxxxxxxx" />
              </div>
              <div class="form-group">
                <label class="form-label">{{ editing ? t('admins.newPassword') : t('login.password') + ' *' }}</label>
                <input v-model="form.password" type="password" class="form-control" :required="!editing" placeholder="••••••••" />
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-ghost" @click="showModal = false">{{ t('common.cancel') }}</button>
              <button type="submit" class="btn btn-primary" :disabled="saving">
                <span v-if="saving" class="spinner spinner-sm"></span>
                {{ t('common.save') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Deactivate confirm modal -->
    <Teleport to="body">
      <div v-if="deactivateTarget" class="modal-overlay" @click.self="deactivateTarget = null">
        <div class="modal" style="max-width:400px;">
          <div class="modal-body" style="text-align:center;padding:2rem;">
            <div style="font-size:2.5rem;margin-bottom:1rem;">🚫</div>
            <h3>Deactivate Account?</h3>
            <p class="text-muted mt-1">
              <strong>{{ deactivateTarget?.full_name }}</strong> will be deactivated and will no longer be able to log in.
            </p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="deactivateTarget = null">{{ t('common.cancel') }}</button>
            <button class="btn btn-danger" @click="deactivateMember" :disabled="saving">
              <span v-if="saving" class="spinner spinner-sm"></span>
              Deactivate
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Permanent Delete confirm modal (Superadmin) -->
    <Teleport to="body">
      <div v-if="permanentDeleteTarget" class="modal-overlay" @click.self="permanentDeleteTarget = null">
        <div class="modal" style="max-width:400px;">
          <div class="modal-body" style="text-align:center;padding:2rem;">
            <div style="font-size:2.5rem;margin-bottom:1rem;">⚠️</div>
            <h3 style="color:var(--danger);">Permanently Delete Account?</h3>
            <p class="text-muted mt-1">
              This action <strong>CANNOT</strong> be undone. Account <strong>{{ permanentDeleteTarget?.full_name }}</strong> will be permanently removed.
            </p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="permanentDeleteTarget = null">{{ t('common.cancel') }}</button>
            <button class="btn btn-danger" @click="permanentDeleteMember" :disabled="saving">
              <span v-if="saving" class="spinner spinner-sm"></span>
              Delete Permanently
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../stores/auth'
import api from '../../api/axios'
import { getAvatarUrl } from '../../utils/avatar'
import AnnualStatementModal from '../../components/AnnualStatementModal.vue'

const { t } = useI18n()
const auth = useAuthStore()

const viewMode = ref('grouped') // 'grouped' or 'flat'
const members = ref([])
const groupedData = ref({ groups: [], unassigned: [], total_first_children: 0, total_members: 0 })
const expandedGroupIds = ref(new Set())

const loading = ref(false)
const saving = ref(false)
const showModal = ref(false)
const editing = ref(null)

const deactivateTarget = ref(null)
const permanentDeleteTarget = ref(null)

const formError = ref('')
const search = ref('')
const paidFilter = ref('')
const statusFilter = ref('active')
const pagination = ref({ total: 0, page: 1, limit: 15, pages: 1 })

const firstChildOptions = ref([])
const miniAdminOptions = ref([])

const form = ref({
  full_name: '',
  phone: '',
  password: '',
  role: 'member',
  first_child_id: null,
  mini_admin_id: null
})

const avatarFile = ref(null)
const avatarPreview = ref(null)

// Annual Statement Modal state
const showStatementModal = ref(false)
const statementMember = ref(null)
const memberContributions = ref([])
const statementYear = ref(new Date().getFullYear())

function switchViewMode(mode) {
  viewMode.value = mode
  if (mode === 'grouped') {
    fetchGroupedMembers()
  } else {
    fetchMembers(1)
  }
}

function isExpanded(id) {
  return expandedGroupIds.value.has(id)
}

function toggleGroup(id) {
  if (expandedGroupIds.value.has(id)) {
    expandedGroupIds.value.delete(id)
  } else {
    expandedGroupIds.value.add(id)
  }
  // Trigger reactivity
  expandedGroupIds.value = new Set(expandedGroupIds.value)
}

const allGroupsExpanded = computed(() => {
  if (!groupedData.value.groups.length) return false
  return groupedData.value.groups.every(g => expandedGroupIds.value.has(g.first_child.id))
})

function expandAllGroups() {
  if (allGroupsExpanded.value) {
    expandedGroupIds.value.clear()
  } else {
    groupedData.value.groups.forEach(g => expandedGroupIds.value.add(g.first_child.id))
    if (groupedData.value.unassigned.length) {
      expandedGroupIds.value.add('unassigned')
    }
  }
  expandedGroupIds.value = new Set(expandedGroupIds.value)
}

const filteredGroups = computed(() => {
  if (!search.value.trim()) return groupedData.value.groups
  const q = search.value.toLowerCase().trim()
  return groupedData.value.groups.filter(g =>
    g.first_child.full_name.toLowerCase().includes(q) ||
    g.first_child.phone.includes(q) ||
    g.members.some(m => m.full_name.toLowerCase().includes(q) || m.phone.includes(q))
  )
})

const fetchError = ref('')

async function fetchGroupedMembers() {
  loading.value = true
  fetchError.value = ''
  try {
    const res = await api.get('/api/members/grouped-by-first-child', {
      params: {
        status: statusFilter.value,
        search: search.value || undefined
      }
    })
    groupedData.value = res.data
    // Groups start collapsed by default (matching the collapsed initial state)
    // Only auto-expand when actively searching
    if (search.value && search.value.trim()) {
      const set = new Set()
      res.data.groups.forEach(g => set.add(g.first_child.id))
      if (res.data.unassigned.length) set.add('unassigned')
      expandedGroupIds.value = set
    } else {
      expandedGroupIds.value = new Set()
    }
  } catch (e) {
    console.error('Error fetching grouped members:', e)
    fetchError.value = e.response?.data?.error || 'Failed to connect to backend server. Please retry.'
  } finally {
    loading.value = false
  }
}

async function fetchFirstChildren() {
  try {
    const res = await api.get('/api/members/first-children')
    firstChildOptions.value = res.data
  } catch (e) { console.error(e) }
}

async function fetchMiniAdmins() {
  try {
    const res = await api.get('/api/members/mini-admins')
    miniAdminOptions.value = res.data
  } catch (e) { console.error(e) }
}

async function openStatement(member) {
  statementMember.value = member
  statementYear.value = new Date().getFullYear()
  try {
    const res = await api.get('/api/contributions', {
      params: { member_id: member.id, limit: 100 }
    })
    memberContributions.value = res.data.data
  } catch (err) {
    console.error('Error fetching member contributions for statement:', err)
    memberContributions.value = []
  }
  showStatementModal.value = true
}

function handleYearChange(newYear) {
  statementYear.value = newYear
}

let debounceTimer = null
function debouncedFetch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    if (viewMode.value === 'grouped') {
      fetchGroupedMembers()
    } else {
      fetchMembers(1)
    }
  }, 350)
}

function handleFilterChange() {
  if (viewMode.value === 'grouped') {
    fetchGroupedMembers()
  } else {
    fetchMembers(1)
  }
}

const visiblePages = computed(() => {
  const pages = []
  const { page, pages: total } = pagination.value
  const start = Math.max(1, page - 2)
  const end = Math.min(total, page + 2)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

function handleFileSelect(event) {
  const file = event.target.files[0]
  if (!file) return
  avatarFile.value = file
  avatarPreview.value = URL.createObjectURL(file)
}

function removeAvatarFile() {
  avatarFile.value = null
  avatarPreview.value = null
}

async function openModal(member = null, presetRole = 'member', presetFirstChildId = null) {
  editing.value = member
  await Promise.all([fetchFirstChildren(), fetchMiniAdmins()])

  if (member) {
    form.value = {
      full_name: member.full_name,
      phone: member.phone,
      password: '',
      role: member.role || 'member',
      first_child_id: member.first_child_id || null,
      mini_admin_id: member.mini_admin_id || null
    }
  } else {
    form.value = {
      full_name: '',
      phone: '',
      password: '',
      role: presetRole || 'member',
      first_child_id: presetFirstChildId || (firstChildOptions.value[0]?.id || null),
      mini_admin_id: auth.user?.role === 'mini_admin' ? auth.user?.id : null
    }
  }

  avatarFile.value = null
  avatarPreview.value = member?.avatar_url || null
  formError.value = ''
  showModal.value = true
}

function confirmDeactivate(member) { deactivateTarget.value = member }
function confirmPermanentDelete(member) { permanentDeleteTarget.value = member }

function formatDate(d) {
  if (!d) return 'N/A'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

async function fetchMembers(page = 1) {
  loading.value = true
  try {
    const res = await api.get('/api/members', {
      params: {
        page,
        limit: 15,
        search: search.value || undefined,
        paid_this_month: paidFilter.value || undefined,
        status: statusFilter.value
      }
    })
    members.value = res.data.data
    pagination.value = res.data.pagination
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

async function saveMember() {
  formError.value = ''
  saving.value = true
  try {
    const formData = new FormData()
    formData.append('full_name', form.value.full_name)
    formData.append('phone', form.value.phone)
    formData.append('role', form.value.role)
    if (form.value.password) formData.append('password', form.value.password)
    if (form.value.first_child_id) formData.append('first_child_id', form.value.first_child_id)
    if (form.value.mini_admin_id) formData.append('mini_admin_id', form.value.mini_admin_id)
    if (avatarFile.value) formData.append('avatar', avatarFile.value)

    const config = { headers: { 'Content-Type': 'multipart/form-data' } }

    if (editing.value) {
      await api.put(`/api/members/${editing.value.id}`, formData, config)
    } else {
      await api.post('/api/members', formData, config)
    }
    showModal.value = false

    if (viewMode.value === 'grouped') {
      fetchGroupedMembers()
    } else {
      fetchMembers()
    }
  } catch (e) {
    formError.value = e.response?.data?.error || t('common.error')
  } finally {
    saving.value = false
  }
}

async function deactivateMember() {
  if (!deactivateTarget.value) return
  saving.value = true
  try {
    await api.delete(`/api/members/${deactivateTarget.value.id}`)
    deactivateTarget.value = null
    if (viewMode.value === 'grouped') fetchGroupedMembers()
    else fetchMembers()
  } catch (e) { console.error(e) }
  finally { saving.value = false }
}

async function activateMember(member) {
  saving.value = true
  try {
    await api.put(`/api/members/${member.id}/activate`)
    if (viewMode.value === 'grouped') fetchGroupedMembers()
    else fetchMembers()
  } catch (e) { console.error(e) }
  finally { saving.value = false }
}

async function permanentDeleteMember() {
  if (!permanentDeleteTarget.value) return
  saving.value = true
  try {
    await api.delete(`/api/members/${permanentDeleteTarget.value.id}/permanent`)
    permanentDeleteTarget.value = null
    if (viewMode.value === 'grouped') fetchGroupedMembers()
    else fetchMembers()
  } catch (e) { console.error(e) }
  finally { saving.value = false }
}

onMounted(() => {
  fetchGroupedMembers()
  fetchFirstChildren()
  fetchMiniAdmins()
})
</script>

<style scoped>
.view-toggle {
  display: flex;
  background: var(--bg-secondary, rgba(255,255,255,0.05));
  padding: 0.2rem;
  border-radius: var(--radius-sm, 6px);
  border: 1px solid var(--border-color);
}

.family-card {
  border: 1px solid var(--border-color, rgba(212,175,55,0.2));
  border-radius: var(--radius-md, 10px);
  overflow: hidden;
  transition: all 0.2s ease;
}

.family-card.is-expanded {
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.family-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  background: var(--bg-secondary, rgba(255,255,255,0.02));
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid transparent;
  transition: background 0.15s;
}

.family-card.is-expanded .family-card-header {
  border-bottom-color: var(--border-color);
  background: rgba(212,175,55,0.06);
}

.family-card-header:hover {
  background: rgba(212,175,55,0.08);
}

.fc-info-col {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.avatar-with-badge {
  position: relative;
}

.fc-avatar-placeholder {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(212,175,55,0.2), rgba(139,26,26,0.2));
  border: 1.5px solid var(--gold);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--gold);
}

.fc-avatar-img {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--gold);
}

.role-mini-pill {
  position: absolute;
  bottom: -2px;
  right: -4px;
  font-size: 0.75rem;
}

.fc-name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.fc-name {
  font-weight: 700;
  font-size: 1.05rem;
  color: var(--text-primary);
}

.fc-subtext {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 0.15rem;
}

.fc-actions-col {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.member-count-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(212,175,55,0.25), rgba(212,175,55,0.1));
  border: 1px solid var(--gold);
  border-radius: 8px;
  padding: 0.25rem 0.75rem;
  min-width: 75px;
}

.unassigned-badge {
  background: rgba(237,137,54,0.15);
  border-color: #dd6b20;
}

.count-num {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--gold);
  line-height: 1;
}

.unassigned-badge .count-num {
  color: #dd6b20;
}

.count-label {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.expand-toggle-btn {
  font-size: 0.85rem;
}

.family-card-body {
  padding: 0;
  background: var(--bg-card);
}

.empty-sub-state {
  padding: 1.5rem;
  text-align: center;
  font-size: 0.875rem;
}

.inner-table {
  margin: 0;
}

.inner-table th {
  background: var(--bg-secondary);
  font-size: 0.75rem;
  padding: 0.6rem 1rem;
}

.inner-table td {
  padding: 0.65rem 1rem;
}

.unassigned-card {
  border-style: dashed;
  border-color: rgba(237,137,54,0.4);
}

/* Role Selector Grid in Modal */
.role-selector-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 0.5rem;
  margin-top: 0.35rem;
}

.role-select-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.65rem 0.4rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}

.role-select-card:hover {
  border-color: var(--gold);
  background: rgba(212,175,55,0.05);
}

.role-select-card.active {
  border-color: var(--gold);
  background: rgba(212,175,55,0.15);
  box-shadow: 0 0 8px rgba(212,175,55,0.2);
}

.r-icon {
  font-size: 1.25rem;
  margin-bottom: 0.2rem;
}

.r-title {
  font-weight: 700;
  font-size: 0.8rem;
  color: var(--text-primary);
}

.r-desc {
  font-size: 0.65rem;
  color: var(--text-muted);
}

.form-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.3rem;
}

.member-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(212,175,55,0.15), rgba(139,26,26,0.15));
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--gold);
  flex-shrink: 0;
}

.member-avatar-img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid var(--gold);
  flex-shrink: 0;
}

.avatar-preview-container {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 2px dashed var(--gold);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: rgba(212,175,55,0.05);
}

.avatar-preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-preview-placeholder {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gold);
}

.score-badge-cell {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
}

.tier-icon {
  font-size: 1.1rem;
}

.score-val {
  font-weight: 700;
  font-family: monospace;
}

.streak-mini {
  background: rgba(237, 137, 54, 0.15);
  color: #dd6b20;
  padding: 0.15rem 0.4rem;
  border-radius: 12px;
  font-weight: 800;
  font-size: 0.72rem;
}

@media (max-width: 600px) {
  .family-card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  .fc-actions-col {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
