document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('create-user-form');
  const tbody = document.getElementById('users-table-body');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const payload = {
      name: formData.get('name'),
      email: formData.get('email'),
      role: formData.get('role'),
    };

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || 'Failed to create user');
        return;
      }

      // Append new row to the table
      const user = data.data;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td>${user.role}</td>
        <td>${new Date(user.createdAt).toLocaleString()}</td>
      `;
      tbody.prepend(tr);

      form.reset();
    } catch (err) {
      console.error(err);
      alert('Error creating user');
    }
  });
});
