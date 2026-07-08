package com.hrms.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.List;
@Configuration
public class CorsConfig {

    @Bean
    public CorsFilter corsFilter() {

        CorsConfiguration config = new CorsConfiguration();

        config.setAllowCredentials(true);

        config.setAllowedOrigins(
                List.of("http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173", "http://127.0.0.1:3000", "http://localhost", "http://localhost:80", "http://localhost:8081", "http://127.0.0.1", "http://127.0.0.1:80", "http://127.0.0.1:8081")
        );

        config.setAllowedHeaders(
                List.of(
                        "Authorization",
                        "Content-Type",
                        "Cache-Control",
                        "Cookie",
                        "X-Requested-With"
                )
        );

        config.setAllowedMethods(
                List.of("GET", "POST", "PUT", "DELETE", "OPTIONS")
        );

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration("/**", config);

        return new CorsFilter(source);
    }
}
