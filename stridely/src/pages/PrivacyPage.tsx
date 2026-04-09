import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import './PrivacyPage.scss';

const PrivacyPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="privacy">
      <div className="privacy__container">
        <button className="privacy__back" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} strokeWidth={2} />
          Volver
        </button>

        <h1 className="privacy__title">Política de Privacidad</h1>
        <p className="privacy__updated">Última actualización: 9 de abril de 2026</p>

        <section className="privacy__section">
          <h2>1. Responsable del tratamiento</h2>
          <p>
            El responsable del tratamiento de los datos personales recogidos a través de <strong>Stridely</strong> es
            el titular del proyecto, accesible mediante el email de contacto:{' '}
            <a href="mailto:privacy@stridely.app">privacy@stridely.app</a>.
          </p>
        </section>

        <section className="privacy__section">
          <h2>2. Datos que recogemos</h2>
          <p>Stridely recoge y trata los siguientes datos personales:</p>
          <ul>
            <li><strong>Datos de cuenta:</strong> nombre y dirección de correo electrónico, necesarios para crear y gestionar tu cuenta.</li>
            <li><strong>Contraseña:</strong> almacenada de forma cifrada. Nunca tenemos acceso a tu contraseña en texto plano.</li>
            <li><strong>Datos de actividad deportiva:</strong> distancia, duración, ritmo, frecuencia cardíaca, desnivel, mapa de ruta y otros parámetros importados desde Strava. Estos datos se consideran datos relativos a la salud según el RGPD (Art. 9) y se tratan con el mayor nivel de protección.</li>
            <li><strong>Perfil de Strava:</strong> nombre público, fotografía de perfil y ubicación (ciudad / país), si has conectado tu cuenta.</li>
            <li><strong>Tokens de autenticación de Strava:</strong> necesarios para mantener la sincronización activa. Se almacenan cifrados y no se comparten con terceros.</li>
          </ul>
        </section>

        <section className="privacy__section">
          <h2>3. Finalidad y base legal del tratamiento</h2>
          <ul>
            <li><strong>Prestación del servicio</strong> (Art. 6.1.b RGPD — ejecución de contrato): mostrarte tu historial de entrenamientos, generar tu plan de entrenamiento personalizado y ofrecerte recomendaciones del Coach IA.</li>
            <li><strong>Mejora del servicio</strong> (Art. 6.1.f RGPD — interés legítimo): análisis anónimos de uso para detectar errores y mejorar la experiencia.</li>
            <li><strong>Datos de salud</strong> (Art. 9.2.a RGPD — consentimiento explícito): los datos de actividad deportiva se tratan únicamente con tu consentimiento expreso, otorgado durante el registro.</li>
          </ul>
        </section>

        <section className="privacy__section">
          <h2>4. Servicios de terceros</h2>
          <ul>
            <li><strong>Supabase</strong> (base de datos y autenticación) — servidores en la UE. Consulta su <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">política de privacidad</a>.</li>
            <li><strong>Strava</strong> (importación de actividades) — los datos se obtienen con tu autorización OAuth. Consulta la <a href="https://www.strava.com/legal/privacy" target="_blank" rel="noopener noreferrer">política de Strava</a>.</li>
            <li><strong>Groq / Meta (Llama 3.3)</strong> (Coach IA) — los mensajes del coach se procesan por la API de Groq. No se envían datos de identificación personal, solo métricas de entrenamiento agregadas y anonimizadas. Consulta la <a href="https://groq.com/privacy-policy/" target="_blank" rel="noopener noreferrer">política de Groq</a>.</li>
            <li><strong>Vercel</strong> (infraestructura web) — aloja el frontend de Stridely. Consulta su <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">política de privacidad</a>.</li>
          </ul>
        </section>

        <section className="privacy__section">
          <h2>5. Conservación de datos</h2>
          <p>
            Tus datos se conservan mientras mantengas una cuenta activa en Stridely. Si eliminas tu cuenta,
            todos tus datos personales serán borrados de nuestros sistemas en un plazo máximo de 30 días,
            salvo que exista obligación legal de conservarlos.
          </p>
        </section>

        <section className="privacy__section">
          <h2>6. Tus derechos (RGPD)</h2>
          <p>Como usuario tienes derecho a:</p>
          <ul>
            <li><strong>Acceso:</strong> solicitar una copia de los datos que tenemos sobre ti.</li>
            <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos.</li>
            <li><strong>Supresión:</strong> solicitar el borrado de tu cuenta y todos tus datos personales.</li>
            <li><strong>Portabilidad:</strong> recibir tus datos en un formato estructurado.</li>
            <li><strong>Oposición / Limitación:</strong> oponerte a ciertos tratamientos o solicitar su limitación.</li>
            <li><strong>Retirada del consentimiento:</strong> puedes retirar tu consentimiento en cualquier momento sin que ello afecte a la licitud del tratamiento previo.</li>
          </ul>
          <p>
            Para ejercer cualquiera de estos derechos, envía un email a{' '}
            <a href="mailto:privacy@stridely.app">privacy@stridely.app</a>.
            También puedes presentar una reclamación ante la{' '}
            <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">Agencia Española de Protección de Datos (AEPD)</a>.
          </p>
        </section>

        <section className="privacy__section">
          <h2>7. Seguridad</h2>
          <p>
            Aplicamos medidas técnicas y organizativas apropiadas para proteger tus datos: comunicaciones
            cifradas mediante HTTPS/TLS, contraseñas hasheadas, tokens de acceso con caducidad y almacenamiento
            en bases de datos con control de acceso estricto.
          </p>
        </section>

        <section className="privacy__section">
          <h2>8. Cambios en esta política</h2>
          <p>
            Podemos actualizar esta política de privacidad ocasionalmente. Te notificaremos cualquier cambio
            material a través de la aplicación. El uso continuado de Stridely tras publicar los cambios
            implica la aceptación de la nueva versión.
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPage;
