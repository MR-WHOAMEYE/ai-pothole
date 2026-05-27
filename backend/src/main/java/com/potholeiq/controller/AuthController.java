package com.potholeiq.controller;

import com.potholeiq.dto.GoogleSyncRequest;
import com.potholeiq.dto.LoginRequest;
import com.potholeiq.dto.RegisterRequest;
import com.potholeiq.model.entity.User;
import com.potholeiq.model.entity.User.UserRole;
import com.potholeiq.repository.UserRepository;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthController(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * POST /api/auth/login
     * Authenticates a user using email and password against PostgreSQL.
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        log.info("Direct login attempt for email: {}", request.getEmail());
        Optional<User> optionalUser = userRepository.findByEmail(request.getEmail().toLowerCase().trim());
        
        if (optionalUser.isEmpty()) {
            log.warn("Login failed: User not found for email: {}", request.getEmail());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid email or password");
        }

        User user = optionalUser.get();
        if (user.getPasswordHash() == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            log.warn("Login failed: Password mismatch or missing hash for email: {}", request.getEmail());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid email or password");
        }

        if (!user.isActive()) {
            log.warn("Login failed: Account is inactive for email: {}", request.getEmail());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Account is inactive");
        }

        log.info("Successful database login for user: {}", user.getEmail());
        return ResponseEntity.ok(user);
    }

    /**
     * POST /api/auth/register
     * Registers a new user directly in PostgreSQL with BCrypt password hashing.
     */
    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
        String emailClean = request.getEmail().toLowerCase().trim();
        log.info("Direct registration attempt for email: {}", emailClean);

        if (userRepository.existsByEmail(emailClean)) {
            log.warn("Registration failed: Email already exists: {}", emailClean);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Email address is already registered");
        }

        User user = new User();
        user.setEmail(emailClean);
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setFullName(request.getFullName().trim());
        user.setPhone(request.getPhone());
        user.setActive(true);

        // Resolve user role based on email context/domain
        UserRole resolvedRole = UserRole.COMMUNITY;
        if (emailClean.contains("admin")) {
            resolvedRole = UserRole.ADMIN;
        } else if (emailClean.contains("crew")) {
            resolvedRole = UserRole.CREW;
        }
        user.setRole(resolvedRole);

        User savedUser = userRepository.save(user);
        log.info("Successfully registered user {} with role {}", savedUser.getEmail(), savedUser.getRole());
        return ResponseEntity.status(HttpStatus.CREATED).body(savedUser);
    }

    /**
     * POST /api/auth/google-sync
     * Synchronizes a Firebase Google Auth user into the PostgreSQL database.
     */
    @PostMapping("/google-sync")
    public ResponseEntity<?> googleSync(@Valid @RequestBody GoogleSyncRequest request) {
        String emailClean = request.getEmail().toLowerCase().trim();
        String firebaseUid = request.getFirebaseUid();
        log.info("Google sync request for email: {} with UID: {}", emailClean, firebaseUid);

        // 1. Check if user already exists by firebaseUid
        Optional<User> userByUid = userRepository.findByFirebaseUid(firebaseUid);
        if (userByUid.isPresent()) {
            User existing = userByUid.get();
            log.info("User already synced by Firebase UID: {}", existing.getEmail());
            return ResponseEntity.ok(existing);
        }

        // 2. Check if user exists by email (perhaps registered earlier or seeded, e.g. admin@potholeiq.com)
        Optional<User> userByEmail = userRepository.findByEmail(emailClean);
        if (userByEmail.isPresent()) {
            User existing = userByEmail.get();
            log.info("User found by email; updating firebaseUid for user: {}", existing.getEmail());
            existing.setFirebaseUid(firebaseUid);
            // Optionally update name if blank
            if ((existing.getFullName() == null || existing.getFullName().isBlank()) && request.getFullName() != null) {
                existing.setFullName(request.getFullName().trim());
            }
            User saved = userRepository.save(existing);
            return ResponseEntity.ok(saved);
        }

        // 3. New OAuth User: Create a new user entry
        User newUser = new User();
        newUser.setEmail(emailClean);
        newUser.setFirebaseUid(firebaseUid);
        newUser.setFullName(request.getFullName() != null ? request.getFullName().trim() : "Google User");
        newUser.setActive(true);

        // Resolve role based on email context
        UserRole resolvedRole = UserRole.COMMUNITY;
        if (emailClean.contains("admin")) {
            resolvedRole = UserRole.ADMIN;
        } else if (emailClean.contains("crew")) {
            resolvedRole = UserRole.CREW;
        }
        newUser.setRole(resolvedRole);

        User saved = userRepository.save(newUser);
        log.info("Successfully created new synced Google user {} with role {}", saved.getEmail(), saved.getRole());
        return ResponseEntity.ok(saved);
    }
}
