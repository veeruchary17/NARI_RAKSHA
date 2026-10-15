package com.safetravel.resource;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.CrossOrigin;

@RestController
@RequestMapping("/api/resources")
@CrossOrigin(origins = {
        "http://127.0.0.1:5500",
        "http://localhost:5500"
})


public class SafetyResourceController {

    @GetMapping
    public List<Map<String, Object>> getSafetyResources() {

        return List.of(
                Map.of(
                        "id", 1,
                        "name", "Demo Police Station",
                        "type", "POLICE_STATION",
                        "latitude", 17.3855,
                        "longitude", 78.4869,
                        "status", "AVAILABLE"
                ),
                Map.of(
                        "id", 2,
                        "name", "Demo CCTV Camera 01",
                        "type", "CCTV",
                        "latitude", 17.3860,
                        "longitude", 78.4875,
                        "status", "ONLINE"
                ),
                Map.of(
                        "id", 3,
                        "name", "Demo Police Station 02",
                        "type", "POLICE_STATION",
                        "latitude", 17.3900,
                        "longitude", 78.4800,
                        "status", "AVAILABLE"
                ),
                Map.of(
                        "id", 4,
                        "name", "Demo CCTV Camera 02",
                        "type", "CCTV",
                        "latitude", 17.3840,
                        "longitude", 78.4900,
                        "status", "ONLINE"
                )
        );
    }
}
