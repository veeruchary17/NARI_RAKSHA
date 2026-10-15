package com.safetravel.controller;

import com.safetravel.entity.SafetyRoute;
import com.safetravel.repository.SafetyRouteRepository;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/routes")
@CrossOrigin(origins = {
        "http://127.0.0.1:5500",
        "http://localhost:5500"
})
public class SafetyRouteController {

    private final SafetyRouteRepository safetyRouteRepository;

    public SafetyRouteController(
            SafetyRouteRepository safetyRouteRepository) {
        this.safetyRouteRepository = safetyRouteRepository;
    }

    @GetMapping
    public List<SafetyRoute> getRoutes() {
        return safetyRouteRepository.findAll();
    }

    @PostMapping
    public SafetyRoute createRoute(@RequestBody SafetyRoute route) {
        return safetyRouteRepository.save(route);
    }
}