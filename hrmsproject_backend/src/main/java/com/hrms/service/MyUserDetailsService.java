//package com.hrms.service;
//import java.util.Optional;
//
//import org.springframework.beans.factory.annotation.Autowired;
//import org.springframework.security.core.userdetails.UserDetails;
//import org.springframework.security.core.userdetails.UserDetailsService;
//import org.springframework.security.core.userdetails.UsernameNotFoundException;
//import org.springframework.stereotype.Service;
//
//import com.hrms.model.UserPrincipal;
//import com.hrms.repository.UserRepository;
//import com.hrms.model.User;
//
//@Service
//public class MyUserDetailsService implements UserDetailsService{
//
//	@Autowired
//	private UserRepository repo;
//	@Override
//	public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
//		// TODO Auto-generated method stub
//	  User user=repo.findByUsername(username);
//		if(user==null) {
//			System.out.println("user 404");
//			throw new UsernameNotFoundException("user 404");
//		}
//		
//		return new UserPrincipal(user);
//	}
//
//}
package com.hrms.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import com.hrms.model.UserPrincipal;
import com.hrms.repository.UserRepository;

@Service
public class MyUserDetailsService implements UserDetailsService {

    @Autowired
    private UserRepository repo;

    @Override
    public UserDetails loadUserByUsername(String username)
            throws UsernameNotFoundException {

        return repo.findByUsername(username)
            .map(UserPrincipal::new)
            .orElseThrow(() ->
                new UsernameNotFoundException("User not found: " + username)
            );
    }
}
