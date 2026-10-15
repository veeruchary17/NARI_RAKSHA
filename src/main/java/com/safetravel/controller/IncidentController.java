package com.safetravel.controller;

import com.safetravel.entity.Incident;
import com.safetravel.repository.IncidentRepository;
import com.safetravel.service.TwilioSmsService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/incidents")
@CrossOrigin(origins = {
        "http://127.0.0.1:5500",
        "http://localhost:5500"
})
public class IncidentController {

    private final IncidentRepository incidentRepository;
    private final TwilioSmsService twilioSmsService;

    public IncidentController(
            IncidentRepository incidentRepository,
            TwilioSmsService twilioSmsService) {

        this.incidentRepository = incidentRepository;
        this.twilioSmsService = twilioSmsService;
    }

    // 1. Trigger an SOS emergency
    @PostMapping("/sos")
    public ResponseEntity<Incident> triggerSOS(
            @RequestBody Incident incident) {

        incident.setIncidentType("SOS");
        incident.setStatus("OPEN");
        incident.setTimestamp(LocalDateTime.now());

        // Save the SOS incident to MySQL first.
        Incident savedIncident = incidentRepository.save(incident);

        // Attempt to notify the configured guardian.
        // SMS failure must not undo the saved incident.
        try {
            String guardianNumber =
                    System.getenv("GUARDIAN_PHONE_NUMBER");

            if (guardianNumber != null
                    && !guardianNumber.isBlank()) {

                twilioSmsService.sendEmergencySms(
                        guardianNumber,
                        savedIncident.getLatitude(),
                        savedIncident.getLongitude()
                );

            } else {
                System.err.println(
                        "Guardian SMS skipped: "
                                + "GUARDIAN_PHONE_NUMBER is not configured."
                );
            }

        } catch (Exception e) {
            System.err.println(
                    "SOS incident saved, but SMS sending failed: "
                            + e.getMessage()
            );
        }

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(savedIncident);
    }

    // 2. Retrieve all incidents
    @GetMapping
    public ResponseEntity<List<Incident>> getAllIncidents() {

        List<Incident> incidents = incidentRepository.findAll();

        return ResponseEntity.ok(incidents);
    }

    // 3. Update an incident's status
    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateIncidentStatus(
            @PathVariable Long id,
            @RequestParam String status) {

        Set<String> allowedStatuses = Set.of(
                "OPEN",
                "DISPATCHED",
                "RESOLVED"
        );

        String normalizedStatus = status.trim().toUpperCase();

        if (!allowedStatuses.contains(normalizedStatus)) {
            return ResponseEntity
                    .badRequest()
                    .body(
                            "Invalid status. Allowed values: "
                                    + "OPEN, DISPATCHED, RESOLVED."
                    );
        }

        return incidentRepository.findById(id)
                .<ResponseEntity<?>>map(incident -> {

                    incident.setStatus(normalizedStatus);

                    Incident updatedIncident =
                            incidentRepository.save(incident);

                    return ResponseEntity.ok(updatedIncident);
                })
                .orElseGet(() -> ResponseEntity
                        .status(HttpStatus.NOT_FOUND)
                        .body("Incident not found: " + id));
    }
}