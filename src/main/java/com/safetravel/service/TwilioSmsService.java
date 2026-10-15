package com.safetravel.service;

import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.type.PhoneNumber;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class TwilioSmsService {

    @Value("${twilio.account-sid}")
    private String accountSid;

    @Value("${twilio.auth-token}")
    private String authToken;

    @Value("${twilio.phone-number}")
    private String fromNumber;

    public void sendEmergencySms(
            String guardianNumber,
            double latitude,
            double longitude) {

        // Initialize Twilio using the configured credentials.
        Twilio.init(accountSid, authToken);

        // Trial accounts accept predefined SMS templates only.
        // This is for integration testing, not the final SOS alert.
        String messageBody = "sms_internal_alerts";

        // Send the SMS.
        Message message = Message.creator(
                new PhoneNumber(guardianNumber),
                new PhoneNumber(fromNumber),
                messageBody
        ).create();

        // Log the result returned by Twilio.
        System.out.println("Twilio message SID: " + message.getSid());
        System.out.println("Twilio SMS status: " + message.getStatus());
    }
}