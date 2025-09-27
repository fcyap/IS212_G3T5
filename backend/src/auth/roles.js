/*path: backend/src/auth.roles*/
const getEffectiveRole = async (sql, userId) => {
  const [{ exists: isAdmin }] = await sql/*sql*/`
    select exists(
      select 1 from system_roles_legacy
      where user_id = ${userId} and role = 'hr_admin'
    ) as exists
  `;

  if (isAdmin) return { label: 'HR/Admin', level: 3 };

  const [{ count: mgrCount }] = await sql/*sql*/`
    select count(*)::int from department_roles_legacy
    where user_id = ${userId} and role = 'manager'
  `;
  if (mgrCount > 0) return { label: 'Manager', level: 2 };

  const [{ count: staffCount }] = await sql/*sql*/`
    select count(*)::int from department_roles_legacy
    where user_id = ${userId} and role = 'staff'
  `;
  if (staffCount > 0) return { label: 'Staff', level: 1 };

  // Fallback: user exists but has no explicit dept role (still can see own tasks via task_members_legacy)
  return { label: 'Staff', level: 1 };
};

module.exports = { getEffectiveRole };