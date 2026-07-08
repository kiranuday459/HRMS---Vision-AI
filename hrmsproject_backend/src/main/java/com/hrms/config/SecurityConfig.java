package com.hrms.config;

import com.hrms.service.MyUserDetailsService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.HttpMethod;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.Authentication;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import com.hrms.security.AuthTokenFilter;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;


import java.util.Arrays;

@Configuration
@EnableWebSecurity
@org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
public class SecurityConfig {

        @Autowired
        private MyUserDetailsService userDetailsService;

        @Bean
        public AuthTokenFilter authenticationJwtTokenFilter() {
                return new AuthTokenFilter();
        }

        @Bean
        public AuthenticationProvider authenticationProvider() {
                DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
                provider.setUserDetailsService(userDetailsService);
                provider.setPasswordEncoder(passwordEncoder());
                return provider;
        }

        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

                http
                                .authenticationProvider(authenticationProvider())
                                .csrf(csrf -> csrf.disable()) // Temporarily disable CSRF completely for API endpoints
                                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                                .sessionManagement(sessionManagement -> sessionManagement
                                                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                                .authorizeHttpRequests(auth -> auth
                                                .requestMatchers(
                                                                "/api/login",
                                                                "/api/auth/**",
                                                                "/api/uploads/**")
                                                .permitAll()
                                                .requestMatchers(HttpMethod.GET, "/api/holidays/**").permitAll()
                                                .requestMatchers(HttpMethod.POST, "/api/holidays/**").hasRole("ADMIN")
                                                .requestMatchers(HttpMethod.PUT, "/api/holidays/**").hasRole("ADMIN")
                                                .requestMatchers(HttpMethod.DELETE, "/api/holidays/**").hasRole("ADMIN")
                                                .requestMatchers("/api/**").authenticated()
                                                .anyRequest().authenticated())
                                .exceptionHandling(ex -> ex.accessDeniedHandler(accessDeniedHandler()));

                http.addFilterBefore(authenticationJwtTokenFilter(), UsernamePasswordAuthenticationFilter.class);

                return http.build();
        }

        @Bean
        public AccessDeniedHandler accessDeniedHandler() {
                return (request, response, accessDeniedException) -> {
                        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
                        System.err.println("ACCESS DENIED: " + request.getRequestURI() + " for user "
                                        + (auth != null ? auth.getName() : "anonymous"));
                        if (auth != null) {
                                System.err.println("Authorities: " + auth.getAuthorities());
                        }
                        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                        response.setContentType("application/json");
                        response.getWriter().write("{\"status\":\"error\",\"message\":\"Access Denied: "
                                        + accessDeniedException.getMessage() + "\"}");
                };
        }

        @Bean
        public AuthenticationManager authenticationManager(
                        AuthenticationConfiguration configuration) throws Exception {
                return configuration.getAuthenticationManager();
        }

        @Bean
        public PasswordEncoder passwordEncoder() {
                return new BCryptPasswordEncoder();
        }

        @Bean
        public CorsConfigurationSource corsConfigurationSource() {
                CorsConfiguration configuration = new CorsConfiguration();
                configuration.setAllowedOriginPatterns(Arrays.asList("*"));
                configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
                configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "X-Requested-With",
                                "Accept",
                                "Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"));
                configuration
                                .setExposedHeaders(Arrays.asList("Access-Control-Allow-Origin",
                                                "Access-Control-Allow-Credentials"));
                configuration.setAllowCredentials(true);
                UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
                source.registerCorsConfiguration("/**", configuration);
                return source;
        }
}
