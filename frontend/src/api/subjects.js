// src/api/subjects.js
import apiClient from './client';

const SubjectsService = {
  getSubjects: async (skip = 0, limit = 100) => {
    const response = await apiClient.get('/materias', {
      params: { skip, limit }
    });
    return response.data;
  },

  getSubject: async (id) => {
    const response = await apiClient.get(`/materias/${id}`);
    return response.data;
  },

  createSubject: async (subjectData) => {
    const response = await apiClient.post('/materias/', subjectData);
    return response.data;
  },

  updateSubject: async (id, subjectData) => {
    const response = await apiClient.put(`/materias/${id}`, subjectData);
    return response.data;
  },

  deleteSubject: async (id) => {
    const response = await apiClient.delete(`/materias/${id}`);
    return response.data;
  }
};

export default SubjectsService;
