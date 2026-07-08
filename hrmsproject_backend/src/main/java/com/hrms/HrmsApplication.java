package com.hrms;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import io.github.cdimascio.dotenv.Dotenv;

@SpringBootApplication
public class HrmsApplication {
	public static void main(String[] args) {
		try {
			// Load .env file from the current working directory
			Dotenv dotenv = Dotenv.configure()
					.ignoreIfMissing()
					.load();

			// Set as system properties so Spring can access them via ${NAME}
			dotenv.entries().forEach(entry -> {
				System.setProperty(entry.getKey(), entry.getValue());
			});

			System.out.println("=== Dotenv: Environment variables loaded ===");
		} catch (Exception e) {
			System.out.println("=== Dotenv: Skipping or failed to load .env file: " + e.getMessage() + " ===");
		}

		SpringApplication.run(HrmsApplication.class, args);
	}
}
