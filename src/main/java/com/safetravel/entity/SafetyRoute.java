package com.safetravel.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

@Entity
public class SafetyRoute {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String source;
    private String destination;

    private double distance;
    private int safetyScore;

    private int streetlightScore;
    private int cctvScore;
    private int policePatrolScore;

    // Default constructor
    public SafetyRoute() {
    }

    // Parameterized constructor
    public SafetyRoute(String source, String destination,
                       double distance, int safetyScore,
                       int streetlightScore, int cctvScore,
                       int policePatrolScore) {

        this.source = source;
        this.destination = destination;
        this.distance = distance;
        this.safetyScore = safetyScore;
        this.streetlightScore = streetlightScore;
        this.cctvScore = cctvScore;
        this.policePatrolScore = policePatrolScore;
    }

    // ID getter and setter
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    // Source getter and setter
    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    // Destination getter and setter
    public String getDestination() {
        return destination;
    }

    public void setDestination(String destination) {
        this.destination = destination;
    }

    // Distance getter and setter
    public double getDistance() {
        return distance;
    }

    public void setDistance(double distance) {
        this.distance = distance;
    }

    // Safety score getter and setter
    public int getSafetyScore() {
        return safetyScore;
    }

    public void setSafetyScore(int safetyScore) {
        this.safetyScore = safetyScore;
    }

    // Streetlight score getter and setter
    public int getStreetlightScore() {
        return streetlightScore;
    }

    public void setStreetlightScore(int streetlightScore) {
        this.streetlightScore = streetlightScore;
    }

    // CCTV score getter and setter
    public int getCctvScore() {
        return cctvScore;
    }

    public void setCctvScore(int cctvScore) {
        this.cctvScore = cctvScore;
    }

    // Police patrol score getter and setter
    public int getPolicePatrolScore() {
        return policePatrolScore;
    }

    public void setPolicePatrolScore(int policePatrolScore) {
        this.policePatrolScore = policePatrolScore;
    }
}