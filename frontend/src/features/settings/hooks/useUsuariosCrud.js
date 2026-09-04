// src/features/settings/hooks/useUsuariosCrud.js
// Hook para operaciones CRUD de usuarios.
import UsuariosService from '../../../api/usuarios';

export function useUsuariosCrud({ showToast, refetchUsuarios }) {
  const handleSaveUser = async (data, editingUser) => {
    try {
      if (editingUser) {
        await UsuariosService.updateUsuario(editingUser.id, data);
        showToast("Usuario actualizado exitosamente");
      } else {
        await UsuariosService.createUsuario(data);
        showToast("Usuario creado exitosamente");
      }
      refetchUsuarios();
      return true;
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Error al guardar usuario';
      return typeof detail === 'string' ? detail : JSON.stringify(detail);
    }
  };

  const handleDeleteUser = async (user) => {
    try {
      await UsuariosService.deleteUsuario(user.id);
      showToast("Usuario eliminado exitosamente", "info");
      refetchUsuarios();
      return true;
    } catch (err) {
      showToast(err?.response?.data?.detail || "Error al eliminar usuario", "error");
      return false;
    }
  };

  return { handleSaveUser, handleDeleteUser };
}
