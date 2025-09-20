// MEDQUEUE-RECEPTIONIST-FRONTEND-MAIN/lib/api.js
// API configuration for frontend to communicate with backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

class MedqueueAPI {
  static async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'API request failed');
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Patient Authentication
  static async signupPatient(name, email, password) {
    return this.request('/user/signup', {
      method: 'POST',
      body: { name, email, password },
    });
  }

  static async loginPatient(email, password) {
    return this.request('/user/login', {
      method: 'POST',
      body: { email, password },
    });
  }

  // Appointment Management
  static async bookAppointment(patientId, doctorId, dateTime) {
    return this.request('/appointments/book', {
      method: 'POST',
      body: { patientId, doctorId, dateTime },
    });
  }

  static async cancelAppointment(appointmentId) {
    return this.request(`/appointments/${appointmentId}/cancel`, {
      method: 'DELETE',
    });
  }

  static async modifyAppointment(appointmentId, newDateTime) {
    return this.request(`/appointments/${appointmentId}/modify`, {
      method: 'PUT',
      body: { newDateTime },
    });
  }

  static async generateQueueNumber(appointmentId) {
    return this.request(`/appointments/${appointmentId}/queue`, {
      method: 'POST',
    });
  }

  static async checkInPatient(appointmentId) {
    return this.request(`/appointments/${appointmentId}/checkin`, {
      method: 'POST',
    });
  }

  static async updateDoctorAvailability(doctorId, schedule) {
    return this.request(`/appointments/doctors/${doctorId}/availability`, {
      method: 'PUT',
      body: schedule,
    });
  }

  static async sendNotification(patientId, message) {
    return this.request('/appointments/notifications/send', {
      method: 'POST',
      body: { patientId, message },
    });
  }

  // Data Retrieval
  static async getDoctors() {
    return this.request('/doctor');
  }

  static async getTimeSlots(doctorId, date) {
    return this.request(`/doctor/${doctorId}/slots?date=${date}`);
  }

  static async getPatientAppointments(patientId) {
    return this.request(`/appointments/patient/${patientId}`);
  }

  static async getPatientQueue(patientId) {
    return this.request(`/appointments/queue/${patientId}`);
  }

  // Test API connection
  static async testConnection() {
    return this.request('/test');
  }

  static async healthCheck() {
    return this.request('/health');
  }
}

export default MedqueueAPI;