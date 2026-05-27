package com.potholeiq.config;

import io.github.cdimascio.dotenv.Dotenv;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.MapPropertySource;

import java.util.HashMap;
import java.util.Map;

/**
 * DotenvConfig — loads the .env file at the very beginning of Spring context
 * initialization (before any @Value or @ConfigurationProperties are resolved)
 * and maps all PG* and BREVO_* variables to Spring datasource / mail properties.
 *
 * Registered via META-INF/spring.factories as an ApplicationContextInitializer.
 */
public class DotenvConfig implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    private static final Logger log = LoggerFactory.getLogger(DotenvConfig.class);

    @Override
    public void initialize(ConfigurableApplicationContext applicationContext) {
        log.info("DotenvConfig: loading .env file...");

        Dotenv dotenv = Dotenv.configure()
                .ignoreIfMissing()   // don't crash if .env is absent (e.g. Render uses real env vars)
                .ignoreIfMalformed()
                .load();

        Map<String, Object> props = new HashMap<>();

        // ── Database ───────────────────────────────────────────────────────────
        String host     = get(dotenv, "PGHOST",     "localhost");
        String dbName   = get(dotenv, "PGDATABASE", "potholeiq");
        String sslMode  = get(dotenv, "PGSSLMODE",  "require");
        String user     = get(dotenv, "PGUSER",     "postgres");
        String password = get(dotenv, "PGPASSWORD", "");

        // Build JDBC URL — PostgreSQL JDBC driver supports sslmode parameter
        String jdbcUrl = String.format(
                "jdbc:postgresql://%s/%s?sslmode=%s",
                host, dbName, sslMode
        );

        props.put("spring.datasource.url",      jdbcUrl);
        props.put("spring.datasource.username", user);
        props.put("spring.datasource.password", password);

        log.info("DotenvConfig: datasource URL = {}", jdbcUrl.replace(password, "***"));

        // ── Brevo SMTP ─────────────────────────────────────────────────────────
        String brevoUser = get(dotenv, "BREVO_USER",    "");
        String brevoKey  = get(dotenv, "BREVO_API_KEY", "");
        String emailFrom = get(dotenv, "EMAIL_FROM",    "noreply@potholeiq.com");
        String emailFromName = get(dotenv, "EMAIL_FROM_NAME", "PotholeIQ");
        String wardEmail = get(dotenv, "COMPLAINT_WARD_EMAIL", "tharankeswaran@gmail.com");

        props.put("spring.mail.username",  brevoUser);
        props.put("spring.mail.password",  brevoKey);
        props.put("app.mail.from",         emailFrom);
        props.put("app.mail.from-name",    emailFromName);
        props.put("complaint.ward-email",  wardEmail);

        log.info("DotenvConfig: mail username = {}, from name = {}, ward email = {}", brevoUser, emailFromName, wardEmail);

        // ── Cloudinary ─────────────────────────────────────────────────────────
        String cloudName = get(dotenv, "CLOUDINARY_CLOUD_NAME", "");
        String apiKey    = get(dotenv, "CLOUDINARY_API_KEY",    "");
        String apiSecret = get(dotenv, "CLOUDINARY_API_SECRET", "");

        props.put("cloudinary.cloud-name", cloudName);
        props.put("cloudinary.api-key",    apiKey);
        props.put("cloudinary.api-secret", apiSecret);

        log.info("DotenvConfig: cloudinary cloud = {}", cloudName);

        // Register as highest-priority property source so it overrides application.properties
        applicationContext.getEnvironment()
                .getPropertySources()
                .addFirst(new MapPropertySource("dotenvProperties", props));

        log.info("DotenvConfig: environment variables loaded successfully.");
    }

    /** Helper: read from dotenv first, then fall back to system env, then defaultValue. */
    private String get(Dotenv dotenv, String key, String defaultValue) {
        String val = dotenv.get(key);
        if (val == null || val.isBlank()) {
            val = System.getenv(key); // also check OS env (useful on Render)
        }
        return (val != null && !val.isBlank()) ? val.trim() : defaultValue;
    }
}
