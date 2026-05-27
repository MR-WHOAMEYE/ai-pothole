package com.potholeiq;

import com.potholeiq.config.DotenvConfig;
import com.potholeiq.model.entity.User;
import com.potholeiq.model.entity.User.UserRole;
import com.potholeiq.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.password.PasswordEncoder;

import org.springframework.scheduling.annotation.EnableAsync;

/**
 * PotholeiqApplication — Spring Boot entry point.
 *
 * On startup:
 *  1. DotenvConfig is registered as ApplicationContextInitializer
 *     to load .env before Spring wires any beans.
 *  2. Hibernate DDL auto-creates all tables (spring.jpa.hibernate.ddl-auto=update).
 *  3. The seedAdminUser CommandLineRunner creates the default ADMIN account
 *     if no users exist in the database.
 *
 * Default admin credentials:
 *   Email:    admin@potholeiq.com
 *   Password: admin123
 */
@SpringBootApplication
@EnableAsync
public class PotholeiqApplication {

    private static final Logger log = LoggerFactory.getLogger(PotholeiqApplication.class);

    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(PotholeiqApplication.class);
        // Register DotenvConfig to run before any @Value or @ConfigurationProperties resolve
        app.addInitializers(new DotenvConfig());
        app.run(args);
    }

    /**
     * Seeds the database with a default ADMIN user on first run.
     * Skipped if at least one user already exists.
     */
    @Bean
    public CommandLineRunner seedAdminUser(UserRepository userRepository,
                                           PasswordEncoder passwordEncoder) {
        return args -> {
            if (userRepository.count() == 0) {
                User admin = new User();
                admin.setEmail("admin@potholeiq.com");
                admin.setPasswordHash(passwordEncoder.encode("admin123"));
                admin.setFullName("PotholeIQ Administrator");
                admin.setRole(UserRole.ADMIN);
                admin.setPhone("+91-0000000000");
                admin.setActive(true);
                userRepository.save(admin);

                log.info("╔══════════════════════════════════════════════╗");
                log.info("║  Default admin user created:                 ║");
                log.info("║  Email:    admin@potholeiq.com               ║");
                log.info("║  Password: admin123                          ║");
                log.info("║  CHANGE THIS PASSWORD IN PRODUCTION!         ║");
                log.info("╚══════════════════════════════════════════════╝");
            } else {
                log.info("Database already seeded — skipping admin user creation.");
            }
        };
    }
}
